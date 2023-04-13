import { Schema, model } from 'mongoose';
import { IFlowLog } from '../types/FlowLog';

const FlowLogSchema = new Schema({
	// save ip address/ mac address to protect against hacks?
	user: {
		type: String,
	},
	wrapperId: {
		type: String,
	},
	flow: {
		type: Array,
		default: [],
	},
	deviceId: String,
	createdAt: {
		type: Date,
		default: Date.now,
	},
});

const FlowLogModel = model<IFlowLog>('FlowLog', FlowLogSchema);
export default FlowLogModel;
