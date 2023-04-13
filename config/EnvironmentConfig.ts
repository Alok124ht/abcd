import { ENVIRONMENT } from './ENVIRONMENT';
import { Socket } from 'socket.io-client';

export type EnvironmentConfig = {
	devPassword: string;
	env: ENVIRONMENT;
	port: number;
	mongooseDebug: boolean;
	jwtSecret: string;
	emailBounceNotificationToken: string;
	mongo: {
		host: string;
		port: string;
		baseUri: string;
		mainDbName: string;
		sessionDbName: string;
	};
	redis: {
		host: string;
		port: number;
	};
	authCookie: {
		sameSite: 'none' | 'lax';
		secure: boolean;
		maxAge: number;
	};
	cors: {
		allowedDomains: (string | RegExp)[];
	};
	zoom: {
		clientId: string;
		clientSecret: string;
		sdkKey: string;
		sdkSecret: string;
	};
	socket: Socket;
	socketBase: string;
	aws: {
		general?: {
			accessId: string;
			secretKey: string;
		};
	};
};
