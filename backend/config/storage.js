/**
 * Storage Configuration
 * Supports both local filesystem and cloud storage (AWS S3, Azure Blob, etc.)
 */

const path = require('path');
const fs = require('fs');
const logger = require('./logger');

// Storage types
const STORAGE_TYPES = {
    LOCAL: 'local',
    S3: 's3',
    AZURE: 'azure',
    GCS: 'gcs' // Google Cloud Storage
};

// Get storage type from environment
const getStorageType = () => {
    return process.env.STORAGE_TYPE || STORAGE_TYPES.LOCAL;
};

// Local storage configuration
const localStorageConfig = {
    uploadDir: process.env.UPLOAD_DIR || path.join(__dirname, '../uploads'),
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024, // 5MB default
    allowedFileTypes: ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'],
    
    ensureUploadDir() {
        if (!fs.existsSync(this.uploadDir)) {
            fs.mkdirSync(this.uploadDir, { recursive: true });
            logger.info(`Created upload directory: ${this.uploadDir}`);
        }
    },
    
    getFilePath(filename) {
        return path.join(this.uploadDir, filename);
    },
    
    getFileUrl(filename) {
        return `/uploads/${filename}`;
    }
};

// AWS S3 configuration
const s3Config = {
    bucket: process.env.AWS_S3_BUCKET,
    region: process.env.AWS_REGION || 'us-east-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    endpoint: process.env.AWS_S3_ENDPOINT, // For S3-compatible services
    
    isConfigured() {
        return !!(this.bucket && this.accessKeyId && this.secretAccessKey);
    },
    
    getFileUrl(filename) {
        if (this.endpoint) {
            return `${this.endpoint}/${this.bucket}/${filename}`;
        }
        return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${filename}`;
    },
    
    // S3 client configuration (requires aws-sdk)
    getClientConfig() {
        return {
            region: this.region,
            credentials: {
                accessKeyId: this.accessKeyId,
                secretAccessKey: this.secretAccessKey
            },
            ...(this.endpoint && { endpoint: this.endpoint })
        };
    }
};

// Azure Blob Storage configuration
const azureConfig = {
    connectionString: process.env.AZURE_STORAGE_CONNECTION_STRING,
    containerName: process.env.AZURE_CONTAINER_NAME || 'uploads',
    accountName: process.env.AZURE_STORAGE_ACCOUNT_NAME,
    
    isConfigured() {
        return !!(this.connectionString || this.accountName);
    },
    
    getFileUrl(filename) {
        return `https://${this.accountName}.blob.core.windows.net/${this.containerName}/${filename}`;
    }
};

// Google Cloud Storage configuration
const gcsConfig = {
    projectId: process.env.GCS_PROJECT_ID,
    keyFilename: process.env.GCS_KEY_FILENAME,
    bucketName: process.env.GCS_BUCKET_NAME,
    
    isConfigured() {
        return !!(this.projectId && this.keyFilename && this.bucketName);
    },
    
    getFileUrl(filename) {
        return `https://storage.googleapis.com/${this.bucketName}/${filename}`;
    }
};

// Get active storage configuration
const getStorageConfig = () => {
    const type = getStorageType();
    
    switch (type) {
        case STORAGE_TYPES.S3:
            if (!s3Config.isConfigured()) {
                logger.warn('S3 not configured, falling back to local storage');
                return { type: STORAGE_TYPES.LOCAL, config: localStorageConfig };
            }
            return { type: STORAGE_TYPES.S3, config: s3Config };
            
        case STORAGE_TYPES.AZURE:
            if (!azureConfig.isConfigured()) {
                logger.warn('Azure Blob Storage not configured, falling back to local storage');
                return { type: STORAGE_TYPES.LOCAL, config: localStorageConfig };
            }
            return { type: STORAGE_TYPES.AZURE, config: azureConfig };
            
        case STORAGE_TYPES.GCS:
            if (!gcsConfig.isConfigured()) {
                logger.warn('Google Cloud Storage not configured, falling back to local storage');
                return { type: STORAGE_TYPES.LOCAL, config: localStorageConfig };
            }
            return { type: STORAGE_TYPES.GCS, config: gcsConfig };
            
        case STORAGE_TYPES.LOCAL:
        default:
            localStorageConfig.ensureUploadDir();
            return { type: STORAGE_TYPES.LOCAL, config: localStorageConfig };
    }
};

// Initialize storage
const storage = getStorageConfig();
logger.info(`Storage initialized: ${storage.type}`);

module.exports = {
    STORAGE_TYPES,
    getStorageType,
    getStorageConfig,
    storage,
    localStorageConfig,
    s3Config,
    azureConfig,
    gcsConfig
};



