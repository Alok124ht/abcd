import { Document, model, Schema } from 'mongoose';
import { Phase } from '../types/Phase';

interface IPhaseJeeConfig extends Document {
	phase: Phase;
	studentName: boolean;
	fatherName: boolean;
	motherName: boolean;
	instituteRollNo: boolean;
	jeeMainsDOB: boolean;
	jeeMainsRegNo: boolean;
	jeeMainsRollNo: boolean;
	jeeMainsMobile: boolean;
	jeeMainsEmail: boolean;
	jeeAdvancedRollNo: boolean;
	jeeAdvancedMobile: boolean;
	jeeAdvancedEmail: boolean;
	jeeAdvancedDOB: boolean;
}

const schema = new Schema({
	phase: { type: Schema.Types.ObjectId, ref: 'Phase', required: true },
	studentName: { type: Boolean, default: false },
	fatherName: { type: Boolean, default: false },
	motherName: { type: Boolean, default: false },
	instituteRollNo: { type: Boolean, default: false },
	jeeMainsDOB: { type: Boolean, default: false },
	jeeMainsRegNo: { type: Boolean, default: false },
	jeeMainsRollNo: { type: Boolean, default: false },
	jeeMainsMobile: { type: Boolean, default: false },
	jeeMainsEmail: { type: Boolean, default: false },
	jeeAdvancedDOB: { type: Boolean, default: false },
	jeeAdvancedRollNo: { type: Boolean, default: false },
	jeeAdvancedMobile: { type: Boolean, default: false },
	jeeAdvancedEmail: { type: Boolean, default: false },
});

const PhaseJeeConfigModel = model<IPhaseJeeConfig>('PhaseJeeConfig', schema);

export = PhaseJeeConfigModel;
