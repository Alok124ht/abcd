import AssessmentCore from '../../assessmentCore.model';
import { UserRole } from '../../../user/IUser';
import { isAtLeast } from '../../../utils/user/role';
import { parseAsInteger, parseAsStringArray } from '../../../utils/query';
import ClientModel from '../../../client/client.model';
import AssessmentWrapper from '../../../assessment/assessmentWrapper.model';
import APIError from '../../../helpers/APIError';
import { projectionWithContentWithoutAnswers } from '../../../question/constants';
import { filter } from 'lodash';

export async function listCoresAdmin(
	req: ExpressRequest,
	res: ExpressResponse,
	next: ExpressNextFunction
) {
	const {
		payload: { role, id },
	} = req;
	const { superGroup } = req.params;
	const limit = parseAsInteger(req.query.limit, 100);
	const phases = parseAsStringArray(req.query.phases);
	const hasSearchedByPhase = !!phases.length;

	if (isAtLeast(UserRole.ADMIN, role)) {
		if (hasSearchedByPhase) {
			try {
				const cores = await AssessmentCore.getByPhaseIdsOrClient(
					superGroup,
					phases,
					null,
					limit
				);
				res.send({ cores, success: true, hasSearchedByPhase });
			} catch (e) {
				res
					.status(422)
					.send({ success: false, message: 'Failed to search by phase for admin' });
			}
		} else {
			await AssessmentCore.get(superGroup, limit)
				.then((cores) => {
					res.json({ success: true, cores });
				})
				.catch(() => {
					res.status(422).json({ success: false });
				});
		}
	} else {
		ClientModel.findOne({ moderators: id }, { _id: 1, phases: 1 })
			.then((client) => {
				const phaseIds = !hasSearchedByPhase
					? client.phases
					: filter(client.phases, (phase) => phases.includes(phase.toString()));
				AssessmentCore.getByPhaseIdsOrClient(
					superGroup,
					phaseIds,
					hasSearchedByPhase ? null : client._id,
					limit
				).then((cores) => {
					res.json({
						success: true,
						cores,
						forPhases: phaseIds,
						hasSearchedByPhase,
					});
				});
			})
			.catch((error) => {
				next(error);
			});
	}
}

export async function getWrapper(
	req: ExpressRequest,
	res: ExpressResponse,
	next: ExpressNextFunction
) {
	const { role } = req.payload;
	const {
		adminPermission: { phases },
	} = res.locals;
	const { wrapperId } = req.params;
	const populate = [];
	const includeCore = parseAsInteger(req.query.core, 0) === 1;
	if (includeCore) {
		populate.push({
			path: 'core',
			populate: {
				path: 'sections.questions.question',
				select: projectionWithContentWithoutAnswers,
			},
		});
	}

	const wrapper = await AssessmentWrapper.findById(wrapperId).populate(populate);
	const hasAccess =
		isAtLeast(UserRole.ADMIN, role) ||
		wrapper.phases.some((phase) => phases.some((p) => p.equals(phase.phase)));
	if (!hasAccess) {
		next(new APIError('You do not have access to this wrapper'));
	} else {
		res.send(wrapper);
	}
}
