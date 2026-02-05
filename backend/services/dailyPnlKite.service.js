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
 * Normalize a strategy identifier (from product name or tag) to a canonical code like "S001".
 * Examples:
 *  - "S1" / "s001" / "S001-Zero Touch" -> "S001"
 *  - "s2-extra" -> "S002"
 */
function normalizeStrategyCode(raw) {
    if (!raw) return null;
    const match = String(raw).match(/S(\d+)/i);
    if (!match) return null;
    const num = match[1] || '';
    const padded = num.padStart(3, '0');
    return `S${padded}`;
}

/**
 * Fetch trades for the day from Kite and calculate account-level P&L for the given date.
 * Uses getPositions() for actual P&L, and getTrades() as fallback for trade-based calculation.
 * This is account-wide (includes all strategies), not strategy/tag specific.
 * @param {Object} credentials - { api_key, access_token }
 * @param {string} tradeDate - YYYY-MM-DD
 * @returns {Promise<{ pnl: number, tradeCount: number, method: string, error?: string }>}
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

            /**
             * Zerodha returns two arrays:
             * - day: intraday positions (day_pnl is today's realised + MTM)
             * - net: overall positions (pnl / net_pnl includes open + closed)
             *
             * Prefer non‑empty day[] for pure daily P&L; otherwise fall back to net[]
             * and use the net P&L fields so that OPEN trades (unrealised) are included.
             */
            const positions = positionsRaw && positionsRaw.day && positionsRaw.day.length
                ? positionsRaw.day
                : (positionsRaw && positionsRaw.net ? positionsRaw.net : []);

            // Sum up account P&L including open positions
            let accountPnl = 0;
            let positionCount = 0;

            for (const pos of positions) {
                // Prefer net P&L which already includes realised + unrealised
                const netPnlValue = Number(
                    pos.pnl ?? pos.net_pnl ?? (
                        (pos.realised != null || pos.unrealised != null)
                            ? Number(pos.realised || 0) + Number(pos.unrealised || 0)
                            : (pos.day_pnl || 0)
                    )
                );

                if (netPnlValue !== 0 || pos.quantity !== 0) {
                    accountPnl += netPnlValue;
                    positionCount++;
                }
            }

            // If we got P&L data from positions, use it (includes open trades)
            if (positionCount > 0 || accountPnl !== 0) {
                pnl = accountPnl;
                tradeCount = positionCount;
                method = 'positions';
                logger.info('Daily PnL from positions (including open trades)', { 
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

/**
 * Fetch detailed trades with tags for a specific date.
 * Returns individual trades with their tags (strategy identifiers).
 * @param {Object} credentials - { api_key, access_token }
 * @param {string} tradeDate - YYYY-MM-DD
 * @returns {Promise<{ trades: Array, error?: string }>}
 */
async function fetchTradesWithDetails(credentials, tradeDate) {
    const { api_key, access_token } = credentials;

    if (!api_key || !access_token) {
        return { trades: [], error: 'Missing api_key or access_token' };
    }

    try {
        // Dynamic import for ES module (kiteconnect v5+)
        if (!KiteConnect) {
            const kiteconnectModule = await import('kiteconnect');
            KiteConnect = kiteconnectModule.KiteConnect;
        }
        
        const kc = new KiteConnect({ api_key });
        kc.setAccessToken(access_token);

        // Check if tradeDate is today (getTrades only works for current day)
        const today = new Date().toISOString().split('T')[0];
        const isToday = tradeDate === today;

        if (!isToday) {
            return { 
                trades: [], 
                error: 'getTrades() only works for current trading day. Historical trades are not available via Kite API.' 
            };
        }

        try {
            // 1) Fetch all trades for today
            const rawTrades = await kc.getTrades();
            const allTrades = (rawTrades && (Array.isArray(rawTrades) ? rawTrades : rawTrades.data)) || [];

            // 2) Fetch today's orders to get tags (tags live on orders, not trades)
            let orderTagMap = {};
            try {
                const rawOrders = await kc.getOrders();
                const allOrders = (rawOrders && (Array.isArray(rawOrders) ? rawOrders : rawOrders.data)) || [];

                orderTagMap = allOrders.reduce((acc, o) => {
                    const oid = o.order_id || o.orderId;
                    if (!oid) return acc;

                    const primaryTag = o.tag || null;
                    const tagsArray = Array.isArray(o.tags) ? o.tags : [];
                    const tagsJoined = tagsArray.join(', ');

                    acc[oid] = {
                        tag: primaryTag,
                        tags: tagsArray,
                        tagsJoined
                    };
                    return acc;
                }, {});
            } catch (orderErr) {
                logger.warn('getOrders failed while enriching trades with tags', { error: orderErr.message, tradeDate });
            }

            // 3) Filter trades by fill_timestamp matching tradeDate and enrich with order tags
            let tradesForDate = allTrades
                .filter((t) => {
                    const fillTs = t.fill_timestamp || t.exchange_timestamp || t.order_timestamp;
                    if (!fillTs) return false;
                    const dateStr = typeof fillTs === 'string' 
                        ? fillTs.split(' ')[0] 
                        : (fillTs.toISOString ? fillTs.toISOString().split('T')[0] : '');
                    return dateStr === tradeDate;
                })
                .map((t) => {
                    const orderId = t.order_id || t.orderId || null;
                    const orderTags = (orderId && orderTagMap[orderId]) || {};
                    const resolvedTag = orderTags.tag || (orderTags.tagsJoined || null);

                    return {
                        order_id: orderId,
                        tradingsymbol: t.tradingsymbol || t.trading_symbol || 'N/A',
                        exchange: t.exchange || 'NSE',
                        instrument_token: t.instrument_token || t.instrumentToken || null,
                        transaction_type: (t.transaction_type || t.transactionType || '').toUpperCase(),
                        quantity: Number(t.quantity ?? t.filled ?? 0),
                        price: Number(t.average_price ?? t.price ?? t.fill_price ?? 0),
                        fill_timestamp: t.fill_timestamp || t.exchange_timestamp || t.order_timestamp || null,
                        // Strategy tag (S001, S002, etc.) comes from the order
                        tag: resolvedTag,
                        product: t.product || 'MIS', // MIS/CNC/NRML (product type, not strategy tag)
                        variety: t.variety || 'regular',
                        validity: t.validity || 'DAY'
                    };
                })
                .sort((a, b) => {
                    // Sort by timestamp (most recent first) or by tradingsymbol
                    const tsA = a.fill_timestamp ? new Date(a.fill_timestamp).getTime() : 0;
                    const tsB = b.fill_timestamp ? new Date(b.fill_timestamp).getTime() : 0;
                    return tsB - tsA;
                });

            /**
             * 4) Infer tags for stop-loss (SL) trades that don't carry a tag.
             * Some brokers / implementations don't copy the strategy tag to SL orders.
             * We try to infer the tag by matching on:
             *  - same tradingsymbol
             *  - same product
             *  - opposite side (BUY vs SELL)
             *  - main trade filled *before* the SL trade (SL triggers later)
             */
            let slInferredCount = 0;
            try {
                // Work on a copy with parsed timestamps for easier matching
                const withMeta = tradesForDate.map((t, index) => ({
                    ...t,
                    __index: index,
                    __time: t.fill_timestamp ? new Date(t.fill_timestamp).getTime() : 0
                }));

                const tradesWithoutTag = withMeta.filter(t => !t.tag);
                logger.info('SL tag inference: checking trades without tags', {
                    tradeDate,
                    totalTrades: tradesForDate.length,
                    tradesWithoutTag: tradesWithoutTag.length
                });

                for (const t of withMeta) {
                    // Only consider trades with missing tag
                    if (t.tag) continue;
                    if (!t.transaction_type || !t.tradingsymbol || !t.product) continue;

                    const side = t.transaction_type.toUpperCase();
                    const oppositeSide = side === 'BUY' ? 'SELL' : side === 'SELL' ? 'BUY' : null;
                    if (!oppositeSide) continue;

                    const thisTime = t.__time || 0;
                    if (!thisTime) continue;

                    // Find candidate "main" trades with tag
                    const candidates = withMeta.filter((c) => {
                        if (!c.tag) return false;
                        if (!c.__time || c.__time > thisTime) return false; // must be before SL
                        if ((c.tradingsymbol || '').trim() !== (t.tradingsymbol || '').trim()) return false;
                        if ((c.product || '').trim().toUpperCase() !== (t.product || '').trim().toUpperCase()) return false;
                        if ((c.transaction_type || '').toUpperCase() !== oppositeSide) return false;
                        // Optional: quantities should be compatible (same or larger on main leg)
                        const mainQty = Number(c.quantity || 0);
                        const slQty = Number(t.quantity || 0);
                        return !slQty || mainQty >= slQty;
                    });

                    if (candidates.length > 0) {
                        // Pick the closest prior trade in time
                        candidates.sort((a, b) => (b.__time || 0) - (a.__time || 0));
                        const parent = candidates[0];
                        if (parent && parent.tag) {
                            tradesForDate[t.__index].tag = parent.tag;
                            slInferredCount++;
                            logger.info('SL tag inferred from main trade (strict match)', {
                                tradeDate,
                                slTrade: {
                                    tradingsymbol: t.tradingsymbol,
                                    transaction_type: t.transaction_type,
                                    product: t.product,
                                    quantity: t.quantity,
                                    time: t.fill_timestamp
                                },
                                inferredTag: parent.tag,
                                mainTrade: {
                                    tradingsymbol: parent.tradingsymbol,
                                    transaction_type: parent.transaction_type,
                                    time: parent.fill_timestamp
                                }
                            });
                            continue;
                        }
                    }

                    // Fallback: If strict SL matching failed, try to infer from any trade with same symbol/product
                    // This handles cases where trades might be related but not strict SL pairs
                    const fallbackCandidates = withMeta.filter((c) => {
                        if (!c.tag) return false;
                        if ((c.tradingsymbol || '').trim() !== (t.tradingsymbol || '').trim()) return false;
                        if ((c.product || '').trim().toUpperCase() !== (t.product || '').trim().toUpperCase()) return false;
                        return true;
                    });

                    if (fallbackCandidates.length > 0) {
                        // Group by tag and pick the most common tag for this symbol/product
                        const tagCounts = {};
                        fallbackCandidates.forEach(c => {
                            const tag = c.tag || 'NO_TAG';
                            tagCounts[tag] = (tagCounts[tag] || 0) + 1;
                        });

                        const mostCommonTag = Object.entries(tagCounts)
                            .sort((a, b) => b[1] - a[1])[0]?.[0];

                        if (mostCommonTag && mostCommonTag !== 'NO_TAG') {
                            tradesForDate[t.__index].tag = mostCommonTag;
                            slInferredCount++;
                            logger.info('Tag inferred from same symbol/product (fallback)', {
                                tradeDate,
                                trade: {
                                    tradingsymbol: t.tradingsymbol,
                                    transaction_type: t.transaction_type,
                                    product: t.product,
                                    quantity: t.quantity,
                                    time: t.fill_timestamp
                                },
                                inferredTag: mostCommonTag,
                                tagFrequency: tagCounts[mostCommonTag],
                                totalMatches: fallbackCandidates.length
                            });
                        } else {
                            logger.debug('Tag inference failed: no matching trades found', {
                                tradeDate,
                                trade: {
                                    tradingsymbol: t.tradingsymbol,
                                    transaction_type: t.transaction_type,
                                    product: t.product,
                                    quantity: t.quantity,
                                    time: t.fill_timestamp
                                }
                            });
                        }
                    } else {
                        logger.debug('Tag inference failed: no trades with same symbol/product', {
                            tradeDate,
                            trade: {
                                tradingsymbol: t.tradingsymbol,
                                transaction_type: t.transaction_type,
                                product: t.product,
                                quantity: t.quantity,
                                time: t.fill_timestamp
                            }
                        });
                    }
                }

                if (slInferredCount > 0) {
                    logger.info('SL tag inference completed', {
                        tradeDate,
                        inferredCount: slInferredCount,
                        totalTrades: tradesForDate.length
                    });
                }
            } catch (inferErr) {
                logger.warn('Failed to infer tags for SL trades', { error: inferErr.message, tradeDate, stack: inferErr.stack });
            }

            // Log summary of tag distribution after inference
            const tagSummary = {};
            tradesForDate.forEach(t => {
                const tag = t.tag || 'NO_TAG';
                tagSummary[tag] = (tagSummary[tag] || 0) + 1;
            });

            const noTagCount = tagSummary['NO_TAG'] || 0;
            const taggedCount = tradesForDate.length - noTagCount;

            logger.info('Fetched trades with details', { 
                tradeDate, 
                tradeCount: tradesForDate.length,
                taggedCount,
                noTagCount,
                slInferredCount,
                tagDistribution: tagSummary,
                ...(noTagCount > 0 ? {
                    warning: `${noTagCount} trade(s) remain untagged after inference attempts`
                } : {})
            });

            return { trades: tradesForDate };
        } catch (tradeErr) {
            logger.error('getTrades failed', { error: tradeErr.message, tradeDate });
            return { 
                trades: [], 
                error: tradeErr.message || 'Failed to fetch trades from Kite API' 
            };
        }
    } catch (err) {
        logger.error('Kite API failed', { error: err.message, tradeDate, stack: err.stack });
        return {
            trades: [],
            error: err.message || 'Kite API error'
        };
    }
}

/**
 * Calculate realised P&L for a specific strategy (by tag) for the given date.
 * Uses trades with matching tags (case-insensitive, normalised via normalizeStrategyCode).
 * Note: This uses trades only (realised P&L), not positions MTM.
 * @param {Object} credentials - { api_key, access_token }
 * @param {string} tradeDate - YYYY-MM-DD
 * @param {string} strategyCodeRaw - e.g. "S001", "s1", "S001-Zero Touch Strangle"
 * @returns {Promise<{ pnl: number, tradeCount: number, method: string, error?: string }>}
 */
async function calculateStrategyPnlFromTrades(credentials, tradeDate, strategyCodeRaw) {
    const targetCode = normalizeStrategyCode(strategyCodeRaw);
    if (!targetCode) {
        return { pnl: 0, tradeCount: 0, method: 'strategy-trades', error: 'Invalid strategy code' };
    }

    const { trades, error } = await fetchTradesWithDetails(credentials, tradeDate);
    if (error) {
        return { pnl: 0, tradeCount: 0, method: 'strategy-trades', error };
    }

    // Filter trades whose tag normalises to the same strategy code
    const strategyTrades = trades.filter((t) => {
        const tradeCode = normalizeStrategyCode(t.tag);
        return tradeCode && tradeCode.toUpperCase() === targetCode.toUpperCase();
    });

    if (!strategyTrades.length) {
        return { pnl: 0, tradeCount: 0, method: 'strategy-trades' };
    }

    // Group by instrument and compute realised P&L using matched BUY/SELL quantities
    const tradesByInstrument = {};
    for (const t of strategyTrades) {
        const instrument = t.tradingsymbol || t.instrument_token || 'unknown';
        if (!tradesByInstrument[instrument]) {
            tradesByInstrument[instrument] = { buys: [], sells: [] };
        }
        const qty = Number(t.quantity || 0);
        const price = Number(t.price || 0);
        const side = (t.transaction_type || '').toUpperCase();

        if (qty > 0 && price > 0) {
            if (side === 'BUY') {
                tradesByInstrument[instrument].buys.push({ qty, price });
            } else if (side === 'SELL') {
                tradesByInstrument[instrument].sells.push({ qty, price });
            }
        }
    }

    let calculatedPnl = 0;
    for (const [, legs] of Object.entries(tradesByInstrument)) {
        const buyQty = legs.buys.reduce((sum, b) => sum + b.qty, 0);
        const sellQty = legs.sells.reduce((sum, s) => sum + s.qty, 0);

        if (!buyQty || !sellQty) continue;

        const avgBuyPrice = legs.buys.reduce((sum, b) => sum + (b.price * b.qty), 0) / buyQty;
        const avgSellPrice = legs.sells.reduce((sum, s) => sum + (s.price * s.qty), 0) / sellQty;

        const matchedQty = Math.min(buyQty, sellQty);
        if (matchedQty > 0 && avgSellPrice > 0 && avgBuyPrice > 0) {
            calculatedPnl += (avgSellPrice - avgBuyPrice) * matchedQty;
        }
    }

    const pnlRounded = Math.round(calculatedPnl * 100) / 100;
    return {
        pnl: pnlRounded,
        tradeCount: strategyTrades.length,
        method: 'strategy-trades'
    };
}

/**
 * For a given account (credentials) and date, compute realised P&L
 * per strategy code (derived from trade tags), and fetch basic
 * account profile info (name and Kite client ID).
 *
 * @param {Object} credentials - { api_key, access_token, api_secret? }
 * @param {string} tradeDate - YYYY-MM-DD
 * @returns {Promise<{
 *   account: { name: string|null, kiteId: string|null } | null,
 *   strategies: Array<{ strategyCode: string, pnl: number, tradeCount: number }>,
 *   error?: string
 * }>}
 */
async function calculateAccountStrategyBreakdown(credentials, tradeDate) {
    const { api_key, access_token } = credentials;

    if (!api_key || !access_token) {
        return { account: null, strategies: [], error: 'Missing api_key or access_token' };
    }

    let profile = null;
    try {
        // Ensure KiteConnect class is initialised
        if (!KiteConnect) {
            const kiteconnectModule = await import('kiteconnect');
            KiteConnect = kiteconnectModule.KiteConnect;
        }
        const kc = new KiteConnect({ api_key });
        kc.setAccessToken(access_token);
        try {
            profile = await kc.getProfile();
        } catch (profileErr) {
            logger.warn('getProfile failed while calculating account strategy breakdown', {
                error: profileErr.message,
                tradeDate
            });
        }
    } catch (initErr) {
        logger.warn('Failed to initialise KiteConnect for profile', { error: initErr.message, tradeDate });
    }

    const { trades, error } = await fetchTradesWithDetails(credentials, tradeDate);
    if (error) {
        return {
            account: profile
                ? {
                    name: profile.user_name || profile.user_shortname || profile.user_id || null,
                    kiteId: profile.user_id || null
                }
                : null,
            strategies: [],
            error
        };
    }

    // Bucket trades by strategy code
    const tradesByStrategy = {};
    for (const t of trades) {
        const code = normalizeStrategyCode(t.tag) || 'NO_TAG';
        if (!tradesByStrategy[code]) {
            tradesByStrategy[code] = [];
        }
        tradesByStrategy[code].push(t);
    }

    const strategies = [];

    for (const [strategyCode, bucketTrades] of Object.entries(tradesByStrategy)) {
        // Group by instrument and compute realised P&L using matched BUY/SELL quantities
        const tradesByInstrument = {};
        for (const t of bucketTrades) {
            const instrument = t.tradingsymbol || t.instrument_token || 'unknown';
            if (!tradesByInstrument[instrument]) {
                tradesByInstrument[instrument] = { buys: [], sells: [] };
            }
            const qty = Number(t.quantity || 0);
            const price = Number(t.price || 0);
            const side = (t.transaction_type || '').toUpperCase();

            if (qty > 0 && price > 0) {
                if (side === 'BUY') {
                    tradesByInstrument[instrument].buys.push({ qty, price });
                } else if (side === 'SELL') {
                    tradesByInstrument[instrument].sells.push({ qty, price });
                }
            }
        }

        let calculatedPnl = 0;
        for (const [, legs] of Object.entries(tradesByInstrument)) {
            const buyQty = legs.buys.reduce((sum, b) => sum + b.qty, 0);
            const sellQty = legs.sells.reduce((sum, s) => sum + s.qty, 0);

            if (!buyQty || !sellQty) continue;

            const avgBuyPrice = legs.buys.reduce((sum, b) => sum + (b.price * b.qty), 0) / buyQty;
            const avgSellPrice = legs.sells.reduce((sum, s) => sum + (s.price * s.qty), 0) / sellQty;

            const matchedQty = Math.min(buyQty, sellQty);
            if (matchedQty > 0 && avgSellPrice > 0 && avgBuyPrice > 0) {
                calculatedPnl += (avgSellPrice - avgBuyPrice) * matchedQty;
            }
        }

        const pnlRounded = Math.round(calculatedPnl * 100) / 100;
        strategies.push({
            strategyCode,
            pnl: pnlRounded,
            tradeCount: bucketTrades.length
        });
    }

    return {
        account: profile
            ? {
                name: profile.user_name || profile.user_shortname || profile.user_id || null,
                kiteId: profile.user_id || null
            }
            : null,
        strategies
    };
}

module.exports = {
    fetchTradesAndCalculatePnl,
    fetchTradesWithDetails,
    normalizeStrategyCode,
    calculateStrategyPnlFromTrades,
    calculateAccountStrategyBreakdown
};
