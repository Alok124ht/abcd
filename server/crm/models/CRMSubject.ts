import { model, Schema } from 'mongoose';

const CRMSubject = new Schema(
	{
		label: String,
		type: String,
		status: [String],
	},
	{
		timestamps: true,
	}
);

const CRMSubjectModel = model('CRMSubject', CRMSubject);
export default CRMSubjectModel;
