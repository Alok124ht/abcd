/**
 * @extends Error
 */
class ExtendableError extends Error {
	status: number;
	isPublic: boolean;
	isOperational: boolean;

	constructor(message: string, status: number, isPublic: boolean) {
		super(message);
		this.name = this.constructor.name;
		this.message = message;
		this.status = status;
		this.isPublic = isPublic;
		this.isOperational = true; // This is required since bluebird 4 doesn't append it anymore.
		Error.captureStackTrace(this, ExtendableError);
	}
}

export default ExtendableError;
