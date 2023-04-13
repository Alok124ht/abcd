import Bucket, { IBookmarkedAtByQuestionId } from './bucket.model';
import { Response } from 'express';
import { Request } from '../types/Request';

const maxAllowedBuckets = 10;

export function add(req: Request, res: Response) {
	const {
		payload: { id },
		body: { name, color },
	} = req;

	Bucket.findOne({ user: id }).then((bucket) => {
		if (!bucket) {
			res.json({ success: false });
		} else if (bucket.buckets.length < maxAllowedBuckets) {
			Bucket.update(
				{ user: id },
				{
					$push: {
						buckets: {
							name,
							color,
							default: undefined,
							questions: [],
						},
					},
				}
			).then(() => {
				res.json({ success: true });
			});
		} else {
			res.json({
				success: false,
				message: `You can not create more than ${maxAllowedBuckets} buckets`,
			});
		}
	});
}

export function addToBucket(req: Request, res: Response) {
	const {
		payload: { id },
		body: { bucket, question },
	} = req;

	const k: IBookmarkedAtByQuestionId = {};
	k['bookmarkedAtByQuestionId.' + question] = new Date();

	Bucket.update(
		{ user: id, 'buckets._id': bucket },
		{ $addToSet: { 'buckets.$.questions': question }, $set: k }
	).then((m) => {
		if (m.nModified) {
			Bucket.findOne({ user: id })
				.populate([
					{ path: 'buckets.questions', select: 'content topic sub_topic' },
				])
				.then((b) => {
					if (b) {
						res.json({ success: true, buckets: b.buckets });
					} else {
						res.json({ success: false });
					}
				});
		} else {
			res.json({ success: false });
		}
	});
}

export function removeFromBucket(req: Request, res: Response) {
	const {
		payload: { id },
		body: { bucket, question },
	} = req;

	const k: IBookmarkedAtByQuestionId = {};
	k['bookmarkedAtByQuestionId.' + question] = null;

	Bucket.update(
		{ user: id, 'buckets._id': bucket },
		{ $pull: { 'buckets.$.questions': question }, $unset: k }
	).then((m) => {
		if (m.nModified) {
			Bucket.findOne({ user: id })
				.populate([
					{ path: 'buckets.questions', select: 'content topic sub_topic' },
				])
				.then((b) => {
					if (b) {
						res.json({ success: true, buckets: b.buckets });
					} else {
						res.json({ success: false });
					}
				});
		} else {
			res.json({ success: false });
		}
	});
}
