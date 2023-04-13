import mongoose, { Document, Model, model } from 'mongoose';

const { Schema } = mongoose;

interface TrackingInfoInterface {
	pathname: string;
	origin: string;
}

interface EmailSubscriptionDocument extends Document {
	email: string;
	unsubscribed: string[];
	trackingInfo: TrackingInfoInterface;
}
interface EmailSubscriptionModelInterface
	extends Model<EmailSubscriptionDocument> {}

const EmailSubscriptionSchema = new Schema(
	{
		email: {
			type: String,
			required: true,
			unique: true,
		},
		mobileNumber: {
			type: String,
		},
		collegeName: {
			type: String,
		},
		unsubscribed: [],
		trackingInfo: {
			pathname: {
				type: String,
			},
			origin: {
				type: String,
			},
		},
	},
	{
		timestamps: true,
	}
);

const EmailSubscriptionModel = model<
	EmailSubscriptionDocument,
	EmailSubscriptionModelInterface
>('EmailSubscription', EmailSubscriptionSchema);

export default EmailSubscriptionModel;
