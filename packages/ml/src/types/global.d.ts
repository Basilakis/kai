declare module '@kai/shared/types/reconstruction' {
    export * from '../../../../shared/src/types/reconstruction';
}

declare module 'fs/promises' {
    export * from 'fs';
}

declare namespace NodeJS {
    interface ProcessEnv {
        PYTHON_PATH?: string;
        ML_SERVICE_URL?: string;
        [key: string]: string | undefined;
    }
}