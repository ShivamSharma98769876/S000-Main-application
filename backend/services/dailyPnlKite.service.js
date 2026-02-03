/**
 * Daily P&L Kite Service
 * Fetches trades from Zerodha Kite API for a date and calculates P&L.
 * Uses api_key and access_token from daily_pnl table.
 * 
 * Note: Kite API getTrades() returns trades for the current trading day only.
 * For historical dates, we use getPositions() which provides net P&L, or calculate from trades.
 */

const logger = require('../config/logger');

// kiteconnect v5+ is ES module, so we use dynamic import
let KiteConnect;

/**
 * Fetch trades for the day from Kite and calculate P&L for the given date.
 * Uses getPositions() for actual P&L, and getTrades() as fallback for trade-based calculation.
 * @param {Object} credentials - { api_key, access_token }
 * @param {string} tradeDate - YYYY-MM-DD
 * @returns {Promise<{ pnl: number, tradeCount: number, error?: string }>}
 */
async function fetchTradesAndCalculatePnl(credentials, tradeDate) {
    const { api_key, access_token } = credentials;

    if (!api_key || !access_token) {
        return { pnl: 0, tradeCount: 0, error: 'Missing api_key or access_token' };
    }

    try {
        // Dynamic import for ES module (kiteconnect v5+)
        if (!KiteConnect) {
            const kiteconnectModule = await import('kiteconnect');
            KiteConnect = kiteconnectModule.KiteConnect;
        }
        
        const kc = new KiteConnect({ api_key });
        kc.setAccessToken(access_token);

        // Check if tradeDate is today (for getTrades to work)
        const today = new Date().toISOString().split('T')[0];
        const isToday = tradeDate === today;

        let pnl = 0;
        let tradeCount = 0;
        let method = '';

        // Method 1: Try getPositions() first - gives actual net P&L for the day
        // getPositions() returns { net: [], day: [] } where day[] has day_pnl
        try {
            const positionsRaw = await kc.getPositions();
            
            // Use 'day' array if available (contains day P&L), otherwise use 'net'
            const positions = positionsRaw && positionsRaw.day 
                ? positionsRaw.day 
                : (positionsRaw && positionsRaw.net ? positionsRaw.net : []);
            
            // Sum up day_pnl from all positions (this is the actual daily P&L)
            let dayPnl = 0;
            let positionCount = 0;
            
            for (const pos of positions) {
                // day_pnl is the realized + unrealized P&L for the trading day
                const dayPnlValue = Number(pos.day_pnl || 0);
                if (dayPnlValue !== 0 || pos.quantity !== 0) {
                    dayPnl += dayPnlValue;
                    positionCount++;
                }
            }
            
            // If we got day P&L data, use it (most accurate)
            if (positionCount > 0 || dayPnl !== 0) {
                pnl = dayPnl;
                tradeCount = positionCount;
                method = 'positions';
                logger.info('Daily PnL from positions (day_pnl)', { 
                    tradeDate, 
                    pnl, 
                    positionCount,
                    positionsData: positions.length 
                });
            }
        } catch (posErr) {
            logger.warn('getPositions failed, trying getTrades', { error: posErr.message, tradeDate });
        }

        // Method 2: Fallback to getTrades() - only works for current trading day
        if (pnl === 0 && isToday) {
            try {
                const raw = await kc.getTrades();
                const allTrades = (raw && (Array.isArray(raw) ? raw : raw.data)) || [];

                // Filter trades by fill_timestamp matching tradeDate
                const tradesForDate = allTrades.filter((t) => {
                    const fillTs = t.fill_timestamp || t.exchange_timestamp || t.order_timestamp;
                    if (!fillTs) return false;
                    const dateStr = typeof fillTs === 'string' 
                        ? fillTs.split(' ')[0] 
                        : (fillTs.toISOString ? fillTs.toISOString().split('T')[0] : '');
                    return dateStr === tradeDate;
                });

                // Calculate realized P&L by matching BUY and SELL trades
                // Group trades by instrument
                const tradesByInstrument = {};
                for (const t of tradesForDate) {
                    const instrument = t.tradingsymbol || t.instrument_token || 'unknown';
                    if (!tradesByInstrument[instrument]) {
                        tradesByInstrument[instrument] = { buys: [], sells: [] };
                    }
                    const qty = Number(t.quantity ?? t.filled ?? 0);
                    const price = Number(t.average_price ?? t.price ?? 0);
                    const side = (t.transaction_type || '').toUpperCase();
                    
                    if (side === 'BUY' && qty > 0 && price > 0) {
                        tradesByInstrument[instrument].buys.push({ qty, price });
                    } else if (side === 'SELL' && qty > 0 && price > 0) {
                        tradesByInstrument[instrument].sells.push({ qty, price });
                    }
                }

                // Calculate P&L: Match BUY and SELL quantities
                let calculatedPnl = 0;
                for (const [instrument, trades] of Object.entries(tradesByInstrument)) {
                    let buyQty = trades.buys.reduce((sum, b) => sum + b.qty, 0);
                    let sellQty = trades.sells.reduce((sum, s) => sum + s.qty, 0);
                    
                    // Average buy and sell prices
                    const avgBuyPrice = trades.buys.length > 0
                        ? trades.buys.reduce((sum, b) => sum + (b.price * b.qty), 0) / buyQty
                        : 0;
                    const avgSellPrice = trades.sells.length > 0
                        ? trades.sells.reduce((sum, s) => sum + (s.price * s.qty), 0) / sellQty
                        : 0;
                    
                    // Realized P&L = (Sell Price - Buy Price) * Min(Buy Qty, Sell Qty)
                    const matchedQty = Math.min(buyQty, sellQty);
                    if (matchedQty > 0 && avgSellPrice > 0 && avgBuyPrice > 0) {
                        calculatedPnl += (avgSellPrice - avgBuyPrice) * matchedQty;
                    }
                }

                if (calculatedPnl !== 0 || tradesForDate.length > 0) {
                    pnl = calculatedPnl;
                    tradeCount = tradesForDate.length;
                    method = 'trades';
                    logger.info('Daily PnL calculated from trades', { 
                        tradeDate, 
                        pnl: calculatedPnl, 
                        tradeCount: tradesForDate.length 
                    });
                }
            } catch (tradeErr) {
                logger.warn('getTrades failed', { error: tradeErr.message });
            }
        }

        // If still no P&L and not today, log warning
        if (pnl === 0 && !isToday) {
            logger.warn('Historical date P&L calculation', {
                tradeDate,
                message: 'getTrades() only works for current day. For historical dates, ensure positions data is available.'
            });
        }

        const pnlRounded = Math.round(pnl * 100) / 100;
        logger.info('Daily PnL final result', {
            tradeDate,
            method,
            tradeCount,
            pnl: pnlRounded
        });

        return { pnl: pnlRounded, tradeCount, method };
    } catch (err) {
        logger.error('Kite API failed', { error: err.message, tradeDate, stack: err.stack });
        return {
            pnl: 0,
            tradeCount: 0,
            error: err.message || 'Kite API error'
        };
    }
}

module.exports = {
    fetchTradesAndCalculatePnl
};
