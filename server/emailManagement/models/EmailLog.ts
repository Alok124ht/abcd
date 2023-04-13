import { Schema, model, Types, Document, Model } from 'mongoose';

const { ObjectId } = Schema.Types;

interface EmailLogBase {
	subject: string;
	to: string[];
	from: string;
	body: string;
	bodyType: string;
	status: 'u' | 'sts' | 'ftsts';
	createdBy: Types.ObjectId;
	createdAt: Date;
	updatedAt: Date;
}
interface EmailLogDocument extends Document, EmailLogBase {}
interface EMailLogModelInterface extends Model<EmailLogDocument> {}

const EmailLog = new Schema(
	{
		subject: {
			type: String,
		},
		to: [
			{
				type: String,
			},
		],
		from: {
			type: String,
		},
		body: {
			type: String,
		},
		bodyType: {
			type: String,
		},
		status: {
			type: String,
			default: 'u',
			enum: ['u', 'sts', 'ftsts'],
			/**
			 * u: unknown
			 * sts: sent to server
			 * ftsts: failed to send to servver
			 */
		},
		createdBy: {
			type: ObjectId,
			ref: 'User',
		},
	},
	{ timestamps: true }
);

const EmailLogModel = model<EmailLogDocument, EMailLogModelInterface>(
	'EmailLog',
	EmailLog
);
export default EmailLogModel;
