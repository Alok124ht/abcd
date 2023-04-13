const assert = require('assert');
const chai = require('chai');
const chaiHttp = require('chai-http');
const server = require('../index');

const should = chai.should();
const expect = chai.expect;

chai.use(chaiHttp);

// const email = 'test1@prepleaf.com'; // use user account! not admin
// const password = 'prepleaf@blue74';
// const portal = 'preparation';

const email = 'hitesh@prepleaf.com'; // use user account! not admin
const password = 'prepleaf@18';
const portal = 'preparation';

const token = '';

const assessmentKeys = [
	'autoGrade',
	'_id',
	'availableFrom',
	'availableTill',
	'cost',
	'reward',
	'syllabus',
	'duration',
	'instructions',
	'name',
];

const completedAssessmentKeys = [
	'assessment', // name, availableFrom, availableFrom are used only in analysis assessment links. redundant!
	'graded',
	'live',
	'response',
	'_id',
];

const userKeys = [
	'_id',
	'demoStep',
	'dp',
	'thumbnail',
	'email',
	'isVerified',
	'liveAssessment', //
	'milestones', //
	'mobileNumber',
	'name',
	'notes', //
	'role',
	'session', //
	'settings', //
	'stats', //
	'subscriptions', //
	'username',
	'xp', //
];

function validateAssessments(assessments) {
	assessments.should.to.be.an('array');
	assessments.forEach((assessment) => {
		assessment.should.to.be.an('object');
		assessment.should.have.all.keys(assessmentKeys);
		assessment.autoGrade.should.to.be.an('boolean');
		assessment._id.should.to.be.an('string');
		assessment.availableFrom.should.to.be.an('string');
		assessment.availableTill.should.to.be.an('string');
		assessment.cost.should.to.be.an('number');
		assessment.reward.should.to.be.an('number');
		assessment.duration.should.to.be.an('number');
		assessment.name.should.to.be.an('string');

		/* Validating syllabus */
		assessment.syllabus.should.to.be.an('object');
		assessment.syllabus.should.have.all.keys('topics');
		assessment.syllabus.topics.should.to.be.an('array');
		assessment.syllabus.topics.forEach((topic) => {
			topic.should.to.be.an('object');
			topic.should.have.all.keys(['id', '_id', 'subTopics']);
			topic.id.should.to.be.an('string');
			topic._id.should.to.be.an('string');
			topic.subTopics.should.to.be.an('array');
			topic.subTopics.forEach((subtopic) => {
				subtopic.should.to.be.an('object');
				subtopic.should.have.all.keys(['id', '_id']);
				subtopic.id.should.to.be.an('string');
				subtopic._id.should.to.be.an('string');
			});
		});

		/* Validating instructions*/
		assessment.instructions.should.to.be.an('array');
		assessment.instructions.forEach((instruction) => {
			instruction.should.to.be.an('object');
			instruction.should.have.all.keys([
				'instruction',
				'sub_instructions',
				'type',
			]);
			instruction.instruction.should.to.be.an('string');
			instruction.sub_instructions.should.to.be.an('array');
			instruction.type.should.to.be.an('string');
			instruction.type.should.eq('text');
			instruction.sub_instructions.forEach((sub_instruction) => {
				sub_instruction.should.to.be.an('object');
				sub_instruction.should.have.all.keys(['instruction', 'type']);
				sub_instruction.instruction.should.to.be.an('string');
				sub_instruction.type.should.to.be.an('string');
				expect(sub_instruction.type).to.satisfy(
					(t) =>
						[
							'text',
							'not-visited-icon',
							'not-answered-icon',
							'answered-icon',
							'not-answered-marked-icon',
							'answered-marked-icon',
						].indexOf(t) !== -1
				);
			});
		});
	});
}

function validateCompletedAssessments(completedAssessments) {
	completedAssessments.should.to.be.an('array');
	completedAssessments.forEach((assessment) => {
		assessment.should.to.be.an('object');
		const keys = Object.keys(assessment);
		let found = -1;
		keys.forEach((k, idx) => {
			if (k === 'meta') found = idx;
		});
		if (found !== -1) keys.splice(found, 1);
		expect(keys).to.have.members(completedAssessmentKeys);
		assessment.graded.should.to.be.an('boolean');
		assessment.live.should.to.be.an('boolean');
		assessment._id.should.to.be.an('string');

		/* Validating response */
		assessment.response.should.to.be.an('object');
		assessment.response.should.have.all.keys('_id', 'sections');
		assessment.response._id.should.to.be.an('string');
		assessment.response.sections.should.to.be.an('array');
		assessment.response.sections.forEach((section) => {
			section.should.to.be.an('object');
			section.should.have.all.keys([
				'_id',
				'name',
				'questions',
				'total_questions',
			]); // total_questions??
			section._id.should.to.be.an('string');
			section.name.should.to.be.an('string');
			section.total_questions.should.to.be.an('number');
			section.questions.should.to.be.an('array');
			section.questions.forEach((question) => {
				question.should.to.be.an('object');
				question.should.have.all.keys(['answer', 'state', 'time']);
				if (question.answer !== null) question.answer.should.to.be.an('string'); // use '' instead of null!!
				question.state.should.to.be.an('number');
				question.time.should.to.be.an('number');
			});
		});

		/* Validating assessment */
		assessment.assessment.should.to.be.an('object');
		assessment.assessment.should.have.all.keys(
			'_id',
			'name',
			'availableFrom',
			'availableTill'
		);
		assessment.assessment._id.should.to.be.an('string');
		assessment.assessment.name.should.to.be.an('string');
		assessment.assessment.availableFrom.should.to.be.an('string');
		assessment.assessment.availableTill.should.to.be.an('string');

		/* Validating meta */
		if (assessment.graded) {
			expect(assessment.meta).to.exist;
			assessment.meta.should.to.be.an('object');
			assessment.meta.should.have.all.keys(
				// are we even using meta here??
				'correctQuestions',
				'correctTime',
				'incorrectQuestions',
				'incorrectTime',
				'marks',
				'marksAttempted',
				'marksGained',
				'marksLost',
				'precision',
				'questionsAttempted',
				'sections',
				'difficulty',
				'unattemptedTime'
			);
			assessment.meta.correctQuestions.should.to.be.an('number');
			assessment.meta.correctTime.should.to.be.an('number');
			assessment.meta.incorrectQuestions.should.to.be.an('number');
			assessment.meta.incorrectTime.should.to.be.an('number');
			assessment.meta.marks.should.to.be.an('number');
			assessment.meta.marksAttempted.should.to.be.an('number');
			assessment.meta.marksGained.should.to.be.an('number');
			assessment.meta.marksLost.should.to.be.an('number');
			assessment.meta.precision.should.to.be.an('number');
			assessment.meta.questionsAttempted.should.to.be.an('number');
			assessment.meta.unattemptedTime.should.to.be.an('number');

			assessment.meta.difficulty.should.to.be.an('object');
			assessment.meta.difficulty.should.have.all.keys('easy', 'medium', 'hard');
			['easy', 'medium', 'hard'].forEach((d) => {
				assessment.meta.difficulty[d].should.to.be.an('object');
				assessment.meta.difficulty[d].should.have.all.keys(
					'correct',
					'incorrect',
					'time',
					'totalAttempts'
				);
				assessment.meta.difficulty[d].correct.should.to.be.an('number');
				assessment.meta.difficulty[d].incorrect.should.to.be.an('number');
				assessment.meta.difficulty[d].time.should.to.be.an('number');
				assessment.meta.difficulty[d].totalAttempts.should.to.be.an('number');
			});
			assessment.meta.sections.should.to.be.an('array');
			assessment.meta.sections.forEach((section) => {
				section.should.to.be.an('object');
				section.should.have.all.keys(
					'correct',
					'correctTime',
					'incorrect',
					'incorrectTime',
					'marks',
					'name',
					'precision',
					'questions',
					'time',
					'_id',
					'unattemptedTime'
				);
				section.correct.should.to.be.an('number');
				section.correctTime.should.to.be.an('number');
				section.incorrect.should.to.be.an('number');
				section.incorrectTime.should.to.be.an('number');
				section.marks.should.to.be.an('number');
				section.name.should.to.be.an('string');
				section.precision.should.to.be.an('number');
				section.time.should.to.be.an('number');
				section.unattemptedTime.should.to.be.an('number');
				section._id.should.to.be.an('string');
				section.questions.should.to.be.an('array');
				section.questions.forEach((question) => {
					question.should.to.be.an('object');
					question.should.have.all.keys('answer', 'correct', 'mark', 'time', '_id');
					question.answer.should.to.be.an('string');
					question.correct.should.to.be.an('number');
					question.mark.should.to.be.an('number');
					question.time.should.to.be.an('number');
					if (question._id !== null) question._id.should.to.be.an('string'); // resolve asap
				});
			});
		}
	});
}

function validateDifficulty(difficulty) {
	difficulty.should.to.be.an('object');
	difficulty.should.have.all.keys(['Easy', 'Medium', 'Hard']);
	difficulty.Easy.should.to.be.an('number');
	difficulty.Medium.should.to.be.an('number');
	difficulty.Hard.should.to.be.an('number');
}

function validateToken(token) {
	token.should.to.be.an('string');
}

function validateRole(role) {
	role.should.to.be.an('string');
}

function validateUser(user) {
	user.should.to.be.an('object');
	user.should.have.all.keys(userKeys);
	user._id.should.to.be.an('string');
	user.demoStep.should.to.be.an('number');
	user.dp.should.to.be.an('string');
	user.thumbnail.should.to.be.an('string');
	user.email.should.to.be.an('string');
	user.isVerified.should.to.be.an('boolean');
	user.mobileNumber.should.to.be.an('string');
	user.name.should.to.be.an('string');
	user.role.should.to.be.an('string');
	user.username.should.to.be.an('string');

	user.liveAssessment.should.to.be.an('object'); // left
	user.milestones.should.to.be.an('array');
	user.milestones.forEach((milestone) => {
		milestone.should.to.be.an('object');
		milestone.should.have.all.keys('achievement', 'date', 'key', '_id');
		milestone.achievement.should.to.be.an('string');
		milestone.date.should.to.be.an('string');
		milestone.key.should.to.be.an('string');
		milestone._id.should.to.be.an('string');
	});

	user.notes.should.to.be.an('object'); // left

	user.session.should.to.be.an('object');
	user.session.should.have.all.keys('live', 'sessions');
	user.session.live.should.to.be.an('string');
	user.session.sessions.should.to.be.an('array');
	user.session.sessions.forEach((session) => {
		session.should.to.be.an('object');
		session.should.have.all.keys('session', '_id');
		session.session.should.to.be.an('string');
		session._id.should.to.be.an('string');
	});

	user.settings.should.to.be.an('object');
	user.settings.should.have.all.keys('sharing', 'goal');
	user.settings.sharing.should.to.be.an('boolean'); // don't send
	user.settings.goal.should.to.be.an('array');
	user.settings.goal.forEach((goal) => {
		goal.should.to.be.an('object');
		goal.should.have.all.keys('date', 'goal');
		goal.goal.should.to.be.an('number');
		goal.date.should.to.be.an('string');
	});

	user.stats.should.to.be.an('object'); // left for now
	user.subscriptions.should.to.be.an('array'); // left for now
	user.xp.should.to.be.an('object'); // left for now
}

function validateTopics(topics) {
	// user.should.to.be.an('object');
	// user.should.have.all.keys(userKeys);
}

describe('Preparation Portal', () => {
	it('Health check', (done) => {
		chai
			.request(server)
			.get(`${process.env.API_BASE_PATH}/health-check`)
			.send({})
			.end((err, res) => {
				res.should.have.status(200);
				res.body.should.to.be.an('object');
				res.body.should.have.all.keys([
					'serverStatus',
					'environment',
					'ip',
					'server',
					'remoteAddress',
				]);
				res.body.serverStatus.should.eq('OK');
				done();
			});
	});

	// describe ('Siginin', function(){
	//     it('Should sign in user', done=>{
	//         console.log ('Signing in ...')
	//         chai.request(server)
	//             .post(`${process.env.API_BASE_PATH}/users/signin`)
	//             .send({user: {email, password, portal}})
	//             .end((err,res)=>{
	//                 res.should.have.status(200);
	//                 validateAssessments(res.body.assessments);
	//                 validateCompletedAssessments(res.body.completedAssessments);
	//                 validateDifficulty(res.body.difficulty);
	//                 // validateFeeds(res.body.feeds);
	//                 // validateGroups(res.body.feeds);
	//                 // validateRecommendations(res.body.feeds);
	//                 validateRole(res.body.role);
	//                 validateToken(res.body.token);
	//                 validateTopics(res.body.topics);
	//                 validateUser(res.body.user);
	//                 console.log('Response Body:', Object.keys(res.body));
	//                 done();
	//             })
	//     });
	// });

	// describe ('Practice Sessions ...', function(){
	//     it('Should sign in user', done=>{
	//         console.log ('Signing in ...')
	//         chai.request(server)
	//             .post(`${process.env.API_BASE_PATH}/users/signin`)
	//             .send({user: {email, password, portal}})
	//             .end((err,res)=>{
	//                 res.should.have.status(200);
	//                 validateAssessments(res.body.assessments);
	//                 validateCompletedAssessments(res.body.completedAssessments);
	//                 validateDifficulty(res.body.difficulty);
	//                 // validateFeeds(res.body.feeds);
	//                 // validateGroups(res.body.feeds);
	//                 // validateRecommendations(res.body.feeds);
	//                 validateRole(res.body.role);
	//                 validateToken(res.body.token);
	//                 validateTopics(res.body.topics);
	//                 validateUser(res.body.user);
	//                 console.log('Response Body:', Object.keys(res.body));
	//                 done();
	//             })
	//     });
	// });

	// .set('headerParameterName', value)
});
