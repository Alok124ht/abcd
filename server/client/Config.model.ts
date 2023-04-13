import { Schema, Types } from 'mongoose';

const ClientConfigSchema = new Schema({
	// Client name visible to
	client: {
		type: Types.ObjectId,
		required: true,
	},
	name: String,
	favicon: String,
	logoDark: String,
	logoDarkHeight: String,
});
