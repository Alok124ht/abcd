import { Schema, model, Document, Model } from 'mongoose';

interface EmailBounceBase {
	e: string;
	ei: string;
	bt: string;
	createdAt: true;
	updatedAt: true;
}

interface EmailBounceDocument extends Document, EmailBounceBase {}
interface EmailBounceModelInterface extends Model<EmailBounceDocument> {}

const EmailBounceSchema = new Schema(
	{
		e: {
			type: String,
			required: true,
			alias: 'email',
		},
		ei: {
			type: String,
			required: true,
			alias: 'emailIdentifier',
		},
		bt: {
			type: String,
			required: true,
			alias: 'bounceType',
		},
	},
	{
		timestamps: true,
	}
);

const EmailBounceModel = model<EmailBounceDocument, EmailBounceModelInterface>(
	'EmailBounce',
	EmailBounceSchema
);

export default EmailBounceModel;
