export interface AuthResponse {
    code?: number;
    method?: string;
    message?: string;
    data?: {
        id: number;
        email: string;
        otp: string | null;
        validate_email: number;
        createdAt: string;
    }[];
    token?: string;
    error?: string;
}

export interface ChatResponse {
    code?: number;
    message?: string;
    data?: string;
    error?: string;
}

export interface ChatRequestBody {
    intelligence: string;
    message: string;
    files: ChatFileToSend[];
}

export interface ChatFileToSend {
    filename: string;
    content: string;
    type: string;
    path: string;
}

export interface fileProyect {
    name: string;
    type: string;
    path: string;
}