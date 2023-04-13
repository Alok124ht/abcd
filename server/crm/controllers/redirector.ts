import { Request } from '../../types/Request';
import { Response, NextFunction } from 'express';
import ShortLinkModel from '../models/ShortLink';
import ShortLinkViewModel from '../models/ShortLinkView';

export async function handleShortLinkRedirect(
	req: Request,
	res: Response,
	next: NextFunction
) {
	const { key } = req.params;
	const shortLink = await ShortLinkModel.findOne({ key });
	if (!shortLink) {
		res.send('We are sorry. We could not find it.');
	} else {
		res.set('Location', shortLink.url);
		res.status(302);
		res.send('Redirecting...');
		const view = new ShortLinkViewModel();
		view.shortLink = shortLink._id;
		view.ip = req.ip;
		await view.save();
		await ShortLinkModel.updateOne(
			{ _id: shortLink._id },
			{ $inc: { visitCount: 1 } }
		);
	}
}
