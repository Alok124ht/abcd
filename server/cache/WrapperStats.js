import { model } from 'mongoose';
import cacheManager from './cache-manager';

const memoryCache = cacheManager({
	max: 100,
	ttl: 60 * 60,
});

const projection = {
	marks: 1,
	'sections.marksWithUser': 1,
	core: 1,
};

const prefix = 'ws-';

function getWrapperAnalysis(id, cacheCallback) {
	const WrapperAnalysis = model('WrapperAnalysis');
	WrapperAnalysis.findById(id, projection)
		.populate([{ path: 'core', select: 'sections.name' }])
		.then((wrapperAnalysis) => {
			if (wrapperAnalysis) {
				cacheCallback(null, wrapperAnalysis.toObject());
			} else {
				cacheCallback(null, wrapperAnalysis);
			}
		})
		.catch((err) => {
			cacheCallback(err);
		});
}

function getManyWrapperAnalysis(ids, cacheCallback) {
	const WrapperAnalysis = model('WrapperAnalysis');
	WrapperAnalysis.find({ _id: { $in: ids } }, projection)
		.populate([{ path: 'core', select: 'sections.name' }])
		.then((wrapperAnalyses) => {
			const wrapperAnalysesById = {};
			wrapperAnalyses.forEach((wrapperAnalysis) => {
				wrapperAnalysesById[wrapperAnalysis._id] = wrapperAnalysis.toObject();
			});
			cacheCallback(
				null,
				ids.map((id) => wrapperAnalysesById[id])
			);
		})
		.catch((err) => {
			cacheCallback(err);
		});
}

export function getMany(ids, cb) {
	const uniqueIds = ids.map((id) => prefix + id);
	if (!uniqueIds.length) {
		cb(null, []);
	} else if (uniqueIds.length === 1) {
		memoryCache.wrap(
			uniqueIds[0],
			(cacheCallback) => {
				getWrapperAnalysis(ids[0], cacheCallback);
			},
			(err, result) => {
				cb(null, [result]);
			}
		);
	} else {
		memoryCache.wrap(
			...uniqueIds,
			(cacheCallback) => {
				getManyWrapperAnalysis(ids, cacheCallback);
			},
			(err, result) => {
				if (err) {
					cb(err, result);
				} else if (uniqueIds.length < 2) {
					cb(null, [result]);
				} else {
					cb(null, result);
				}
			}
		);
	}
}

export function clear(wrapperAnalysisId) {
	memoryCache.del(`${prefix}-${wrapperAnalysisId}`);
}
