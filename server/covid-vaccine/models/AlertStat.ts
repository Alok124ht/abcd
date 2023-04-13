import { Schema, Types, model, Document, Model } from 'mongoose';
import { getRandomString } from '../../utils/string';

const generateKey = () => getRandomString(8, { onlyAlphabets: true });

const AlertStatSchema = new Schema(
	{
		request: {
			type: Schema.Types.ObjectId,
			ref: 'VaccineAvailabilityNotificationRequest',
			index: true,
			required: true,
		},
		key: {
			type: String,
			default: generateKey,
			index: true,
			unique: true,
		},
		// message click count
		mcc: { type: Number, default: 0, required: true },
	},
	{ timestamps: true }
);

AlertStatSchema.static(
	'getOrCreate',
	async function getOrCreate(this: AlertStatModel, requestId: Types.ObjectId) {
		const item = await this.findOne({ request: requestId });
		if (item) {
			return item;
		}
		console.log('item found', item);
		let key = generateKey();
		while (true) {
			const keyExists = await this.count({ key });
			if (!keyExists) {
				break;
			}
			key = generateKey();
		}
		const alertStat = new this({ key, request: requestId });
		alertStat.save();
		return alertStat;
	}
);

export interface AlertStatBase {
	alert: Types.ObjectId;
	mcc: number;
	key: string;
	createdAt?: Date;
	updatedAt?: Date;
}

export interface AlertStatDocument extends Document, AlertStatBase {}

interface AlertStatModel extends Model<AlertStatDocument> {
	getOrCreate(
		this: AlertStatModel,
		requestId: Types.ObjectId
	): Promise<AlertStatDocument>;
}

export default model<AlertStatDocument, AlertStatModel>(
	'AlertStat',
	AlertStatSchema
);
