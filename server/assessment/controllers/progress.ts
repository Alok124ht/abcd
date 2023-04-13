import { Response } from 'express';
import { cloneDeep } from 'lodash';
import { Request } from '../../types/Request';
import FlowLog from '../../log/flowlog.model';
import UserLiveAssessmentCache from '../../cache/UserLiveAssessment';
import UserLiveAssessment, {
	IUserLiveAssessment,
} from '../../user/UserLiveAssessment';
import { FlowItem } from '../../types/Submission';

function removeOverlap(savedFlow: FlowItem[], flowFromClient: FlowItem[]) {
	const flowMap: { [flowItemId: number]: boolean } = {};
	savedFlow.forEach((flowItem) => {
		flowMap[flowItem.id] = true;
	});

	const newFlow: FlowItem[] = [];
	flowFromClient.forEach((flowItem) => {
		if (!flowMap[flowItem.id]) {
			newFlow.push(flowItem);
		}
	});
	return newFlow;
}

function fixTime(flow: FlowItem[], lastTime: number) {
	// check if he is out of time after this api!?
	const timeNow = new Date().getTime(); // what if this time is too much!!?
	const diff = timeNow - lastTime;
	let bestGuess = diff;
	let sumProperTime = 0;
	let countProperTime = 0;
	flow.forEach((f) => {
		if (f.time > 0 && f.time < diff) {
			// what is time is null!!. will not enter the condition
			sumProperTime += f.time;
			countProperTime += 1;
		}
	});
	if (countProperTime) bestGuess = sumProperTime / countProperTime;
	flow.forEach((f) => {
		if (f.time < 0 || f.time > diff) {
			f.time = bestGuess;
		}
	});

	// console.log('check new flow time fixed', flow);

	let sumTime = 0;
	flow.forEach((f) => {
		if (f.time) {
			sumTime += f.time;
		}
	});
	const factor = sumTime > 0 ? (1.0 * diff) / sumTime : 0;
	// what if sumTime is 0. it should normally!

	const newFlow: FlowItem[] = [];

	let timeUsed = lastTime;
	flow.forEach((f) => {
		f.time = f.time ? factor * f.time : 0;
		timeUsed += f.time ? f.time : 0;
		f.endTime = timeUsed;
		newFlow.push(f);
	});
	return { newFlowFixed: newFlow, timeNow };
}

export function syncFlow(
	req: Request,
	res: Response & {
		locals: { flow: FlowItem[]; userLiveAssessment: IUserLiveAssessment };
	}
) {
	const { flow, userLiveAssessment } = res.locals;
	const { deviceId } = req.body;

	// check if this is correct device ID
	if (userLiveAssessment.deviceId !== deviceId) {
		// throw error and do not sync
		// also front end should stop it
	}

	FlowLog.create({
		user: req.payload.id,
		wrapperId: userLiveAssessment.assessmentWrapperId.toString(),
		flow: cloneDeep(flow),
		deviceId,
	});

	// cache or optimize this //liveAssessment
	const newFlow = removeOverlap(userLiveAssessment.flow, flow);
	const startTime = new Date(userLiveAssessment.startTime).getTime();
	let lastTime = startTime;
	if (userLiveAssessment.flow.length) {
		lastTime =
			userLiveAssessment.flow[userLiveAssessment.flow.length - 1].endTime;
	}
	const { newFlowFixed, timeNow } = fixTime(newFlow, lastTime);
	const maxDurationAllowed = userLiveAssessment.duration * 1100;
	if (timeNow > startTime + maxDurationAllowed) {
		// 10% relaxation!
		res.json({
			success: false,
			error: { code: 'assessment-time-exceeded' },
			newFlow: [],
			currTime: timeNow,
			startTime: userLiveAssessment.startTime,
		});
	} else {
		let skip = -1;
		if (userLiveAssessment.flow.length && newFlowFixed.length) {
			const lastFlow = userLiveAssessment.flow[userLiveAssessment.flow.length - 1];
			if (
				lastFlow.section === newFlowFixed[0].section &&
				lastFlow.question === newFlowFixed[0].question
			) {
				// add time
				userLiveAssessment.flow[userLiveAssessment.flow.length - 1].id =
					newFlowFixed[0].id;
				userLiveAssessment.flow[userLiveAssessment.flow.length - 1].time +=
					newFlowFixed[0].time;
				userLiveAssessment.flow[userLiveAssessment.flow.length - 1].endTime =
					newFlowFixed[0].endTime;
				userLiveAssessment.flow[userLiveAssessment.flow.length - 1].action =
					newFlowFixed[0].action;
				userLiveAssessment.flow[userLiveAssessment.flow.length - 1].state =
					newFlowFixed[0].state;
				userLiveAssessment.flow[userLiveAssessment.flow.length - 1].response =
					newFlowFixed[0].response;
				skip = 0;
			}
		}
		newFlowFixed.forEach((f, idx) => {
			if (idx !== skip) {
				userLiveAssessment.flow.push(f);
			}
		});

		UserLiveAssessmentCache.set(req.payload.id, userLiveAssessment, (error) => {
			UserLiveAssessment.update(
				{ user: req.payload.id },
				{
					$set: { flow: userLiveAssessment.flow },
				}
			).exec();
			res.json({
				success: true,
				newFlow: userLiveAssessment.flow,
				currTime: timeNow,
				startTime: userLiveAssessment.startTime,
			});
		});
	}
}
