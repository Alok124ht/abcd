import { Server } from 'http';
import stoppable from 'stoppable';
import logger from './winston';

function createExitHandler(
	server: Server,
	options = { coredump: false, timeout: 500 }
) {
	// Exit function

	return (code: number, reason: string, doNotStop?: boolean) => (
		err?: Error
	) => {
		const exit = (code: number) => {
			options.coredump ? process.abort() : process.exit(code);
		};
		if (err && err instanceof Error) {
			// Log error information, use a proper logging library here :)
			logger.error(err.message, err.stack);
		} else {
			logger.error(`ErrorHandling: Unknown error occurred. ${code} ${reason}`);
		}

		const onExit = (e?: Error) => {
			if (e) {
				logger.error('onExit called with', e);
			}
			logger.error(`ErrorHandling:onExit: code: ${code}; reason: ${reason}`);
			if (err && err instanceof Error) {
				logger.error(
					`ErrorHandling: Error message: ${err.message}; Stack Trace: ${err.stack}`
				);
			}
			exit(code);
		};

		// Attempt a graceful shutdown
		logger.info(
			`ErrorHandling: calling graceful stop for code: ${code}, reason: ${reason} Err:${
				err ? err.message : 'No error'
			}`
		);
		if (!doNotStop) {
			server.stop(onExit);
		}
		logger.info('ErrorHandling: graceful stop called');
	};
}

export function setUpExitListeners(server: Server) {
	stoppable(server, 1500);

	const exitHandler = createExitHandler(server, {
		coredump: false,
		timeout: 500,
	});

	console.log('setting up error handling');
	process.on('uncaughtException', exitHandler(1, 'Unexpected Error'));
	process.on('unhandledRejection', exitHandler(1, 'Unhandled Promise', true));
	process.on('SIGTERM', exitHandler(0, 'SIGTERM'));
	process.on('SIGINT', exitHandler(0, 'SIGINT'));
}
