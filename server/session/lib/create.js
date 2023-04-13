import Session from '../session.model';

const tooSlowDetectorMap = {
	puq: 'preventUnseenQuestions',
	ts: 'tooSlow',
	med: 'median',
};

function parseConfig(rawConfig) {
	const config = { prevent: {}, questions: {} };
	if (rawConfig.totalQuestions) {
		const totalQuestions = parseInt(rawConfig.totalQuestions, 10);
		if (Number.isNaN(totalQuestions)) {
			throw new Error('if mentioned, totalQuestions must me a number');
		}
		config.questions.total = totalQuestions;
	}
	if (rawConfig.shouldSelect) {
		const shouldSelect = parseInt(rawConfig.shouldSelect, 10);
		if (Number.isNaN(shouldSelect)) {
			throw new Error('if mentioned, shouldSelect must me a number');
		}
		config.questions.shouldSelect = shouldSelect;
	}
	if (rawConfig.preventTooSlow === '1') {
		config.prevent.tooSlow = true;
	}
	if (rawConfig.preventTooFast === '1') {
		config.prevent.tooFast = true;
		config.tooFastMultiplier = 1; // default value is 1 if not set
	}
	if (rawConfig.clockType === 'timer') {
		config.clockType = 'timer';
	}
	if (rawConfig.allowReattempt === '1') {
		config.prevent.reattempt = false;
	}
	if (rawConfig.canSkip === '1') {
		config.prevent.skip = false;
	}
	if (rawConfig.disableBack === '1') {
		config.prevent.back = true;
	}
	if (rawConfig.timeLimit) {
		const limit = parseInt(rawConfig.timeLimit, 10);
		if (Number.isNaN(limit)) {
			throw new Error('timeLimit must be a number');
		}
		config.timeLimit = limit;
	}
	if (rawConfig.tooFastMultiplier) {
		const tooFastMultiplier = parseInt(rawConfig.tooFastMultiplier, 10);
		if (Number.isNaN(tooFastMultiplier)) {
			throw new Error('tooFastMultiplier must be a number');
		}
		config.tooFastMultiplier = tooFastMultiplier;
	}
	if (rawConfig.alertBeforeTooSlow) {
		const alertBeforeTooSlow = parseInt(rawConfig.alertBeforeTooSlow, 10);
		if (Number.isNaN(alertBeforeTooSlow)) {
			throw new Error('alertBeforeTooSlow must be a number');
		}
		config.alertBeforeTooSlow = alertBeforeTooSlow;
	}
	if (rawConfig.questionSelectionTimeLimit) {
		const questionSelectionTimeLimit = parseInt(
			rawConfig.questionSelectionTimeLimit,
			10
		);
		if (Number.isNaN(questionSelectionTimeLimit)) {
			throw new Error('questionSelectionTimeLimit must be a number');
		}
		config.questionSelectionTimeLimit = questionSelectionTimeLimit;
	}
	if (rawConfig.selector) {
		config.selector = rawConfig.selector;
	}
	if (rawConfig.sessionType) {
		config.sessionType = rawConfig.sessionType;
	}
	if (config.prevent.tooSlow && rawConfig.tooSlowDetector) {
		config.tooSlowDetector =
			tooSlowDetectorMap[rawConfig.tooSlowDetector] || tooSlowDetectorMap.ts;
	}
	return config;
}

const createSession = ({
	user,
	filters,
	title,
	config: rawConfig,
	assessment,
}) => {
	const promise = new Promise((resolve, reject) => {
		let config;
		try {
			config = parseConfig(rawConfig);
		} catch (configParseError) {
			reject(configParseError.message);
			return;
		}

		const sessionObject = {
			user,
			filters,
			startTime: Date.now(),
			title,
			config,
		};
		if (assessment) {
			sessionObject.reference = assessment;
			sessionObject.onModel = 'Assessment';
		}
		const session = new Session(sessionObject);

		session.save((error, savedSession) => {
			if (!error) {
				resolve(savedSession);
			} else {
				reject(error);
			}
		});
	});
	return promise;
};

export default createSession;
