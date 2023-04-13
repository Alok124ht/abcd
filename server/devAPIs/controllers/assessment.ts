import WrapperAnalysisModel from '../../assessment/wrapperAnalysis.model';

export async function testWrapperAnalysis(
	req: ExpressRequest,
	res: ExpressResponse,
	next: ExpressNextFunction
) {
	const wrapperAnalysis = await WrapperAnalysisModel.findOne().sort({ _id: -1 });
	if (!wrapperAnalysis) {
		next(new Error('No document found'));
	} else {
		await wrapperAnalysis.coreAnalysis();
		res.send({ wrapperAnalysis: wrapperAnalysis.toObject() });
	}
}
