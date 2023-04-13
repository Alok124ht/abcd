import { Response } from 'express';
import axios from 'axios';
import { Request } from '../../types/Request';
import { State } from '../models/GeoState';
import StateModel from '../models/GeoState';
import DistrictModel, { District, DistrictBase } from '../models/GeoDistrict';

export async function createStatesDatabase(req: Request, res: Response) {
	const response = await axios(
		`https://cdn-api.co-vin.in/api/v2/admin/location/states`
	);
	const data = response.data;
	const states: State[] = data.states.map((responseState: any) => {
		return {
			name: responseState.state_name,
			stateId: responseState.state_id,
		};
	});
	await StateModel.bulkWrite(
		states.map((state) => ({
			updateOne: {
				filter: { stateId: state.stateId },
				update: { $set: state },
				upsert: true,
			},
		}))
	);
	const allStates = await StateModel.find();
	res.send(allStates);
}

export async function createDistrictsDatabase(req: Request, res: Response) {
	const allStates = await StateModel.find();

	for (let index = 0; index < allStates.length; index += 1) {
		const state = allStates[index];
		const response = await axios(
			`https://cdn-api.co-vin.in/api/v2/admin/location/districts/${state.stateId}`
		);
		const data = response.data;
		const districts: DistrictBase[] = data.districts.map(
			(responseDistrict: any) => {
				return {
					name: responseDistrict.district_name,
					districtId: responseDistrict.district_id,
					state: state._id,
				};
			}
		);
		await DistrictModel.bulkWrite(
			districts.map((district) => ({
				updateOne: {
					filter: { districtId: district.districtId },
					update: { $set: district },
					upsert: true,
				},
			}))
		);
	}
	const allDistricts = await DistrictModel.find().populate('state');
	res.send(allDistricts);
}
