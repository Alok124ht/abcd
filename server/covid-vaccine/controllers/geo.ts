import { Response } from 'express';
import GeoDistrict from '../models/GeoDistrict';

export async function getDistricts(_req: any, res: Response) {
	const districts = await GeoDistrict.find().populate({ path: 'state' });
	res.send({ items: districts });
}
