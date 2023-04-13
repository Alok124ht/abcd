import { Response } from 'express';
import { Request } from '../../types/Request';
import AssessmentCoreCache from '../../cache/AssessmentCore';
import UserManager from '../../globals/UserManager';
import { AssessmentCoreInterface } from '../../types/AssessmentCore';

export async function startAssessment(_req: Request, res: Response) {
	const { assessmentWrapper, user } = res.locals;
	AssessmentCoreCache.getWithQuestions(
		assessmentWrapper.core,
		(error: Error, assessmentCore: AssessmentCoreInterface) => {
			if (error || !assessmentCore) {
				res.status(500).send({ message: 'Not found!', error });
				return;
			}
			if (
				user.netXp.val >= assessmentWrapper.cost ||
				user.liveAssessment.assessmentWrapperId.toString() ===
					assessmentWrapper._id.toString()
			) {
				const t2 = new Date().getTime();
				if (
					user.liveAssessment.assessmentWrapperId &&
					user.liveAssessment.assessmentWrapperId.toString() ===
						assessmentWrapper._id.toString()
				) {
					/**
					 * It means this assessment is already in progress
					 */
					res.send({
						wrapper: assessmentWrapper,
						core: assessmentCore,
						startTime: user.liveAssessment.startTime,
						currTime: t2,
					});
				} else {
					const timeNow = new Date();
					UserManager.enqueueAssessmentRequests({
						userId: user._id,
						userXpId: user.netXp.xp,
						wrapperId: assessmentWrapper._id,
						timeNow,
						duration: assessmentCore.duration,
						xpVal: -assessmentWrapper.cost,
					});
					UserManager.throttledProcessAssessmentRequests();
					res.send({
						wrapper: assessmentWrapper,
						core: assessmentCore,
						startTime: new Date(),
						currTime: t2,
					});
				}
			} else {
				res.json({
					success: false,
					error: { code: 'not-enough-xp' },
				});
			}
		}
	);
}
