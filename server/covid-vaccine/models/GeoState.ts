import { Schema, Document, Types, model, Model } from 'mongoose';

const StateSchema = new Schema(
	{
		name: { type: String, required: true },
		stateId: { type: Number, required: true, unique: true, index: true },
	},
	{ timestamps: true }
);

interface StateBase {
	name: string;
	stateId: number;
	createdAt: Date;
	updatedAt: Date;
}

export interface State extends Document, StateBase {}
interface StateModel extends Model<State> {}

export default model<State, StateModel>('GeoState', StateSchema);
