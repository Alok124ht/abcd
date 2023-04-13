import { Document } from 'mongoose';
import { FlowItem } from './Submission';

interface IFlowLog extends Document {
	user: string;
	wrapperId: string;
	flow: FlowItem[];
	createdAt?: Date;
}
