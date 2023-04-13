import { Router } from 'express';
// import Question from '../question/question.model';
// // import ClientModel from '../client/client.model';
// // import UserModel from '../user/user.model';
// // import { UserRole } from 'server/user/IUser';
// import { Types } from 'mongoose';
// import { QuestionTypes } from 'server/question/QuestionType';
import { sattleCorefor6, sattleSubmissions6 } from './temp.controller';
// const { ObjectId } = Types;
const tempRoutes = Router();

// // tempRoutes.route('/change-to-lms').get((req, res) => {
// // 	UserModel.updateMany(
// // 		{},
// // 		{
// // 			$set: {
// // 				portal: 'lms',
// // 			},
// // 		}
// // 	)
// // 		.then((value) => {
// // 			res.send(value);
// // 		})
// // 		.catch((err) => {
// // 			res.send(err);
// // 		});
// // });

// // tempRoutes.route('/change-to-lms/clients').get((req, res) => {
// // 	ClientModel.updateMany(
// // 		{},
// // 		{
// // 			$set: {
// // 				portal: 'lms',
// // 			},
// // 		}
// // 	)
// // 		.then((value) => {
// // 			res.send(value);
// // 		})
// // 		.catch((err) => {
// // 			res.send(err);
// // 		});
// // });
// // tempRoutes
// // 	.route('/convert/to/super')
// // 	.get((req: ExpressRequest, res: ExpressResponse) => {
// // 		UserModel.updateMany(
// // 			{
// // 				email: { $in: ['neel@prepseed.com', 'aman123@prepseed.com'] },
// // 			},
// // 			{
// // 				$set: {
// // 					role: UserRole.SUPER,
// // 				},
// // 			}
// // 		)
// // 			.then((value) => {
// // 				res.send(value);
// // 			})
// // 			.catch((err) => {
// // 				res.send(err);
// // 			});
// // 	});

// tempRoutes.get(
// 	'/change-question-type',
// 	async (req: ExpressRequest, res: ExpressResponse) => {
// 		const response: any[] = [];
// 		Question.findById('624c4ce0c4ab6f1a86e4014e')
// 			.then((que1) => {
// 				Question.updateOne(
// 					{
// 						_id: ObjectId('624c4ce0c4ab6f1a86e4014e'),
// 					},
// 					{
// 						$set: {
// 							type: QuestionTypes.LINKED_MCMC,
// 							multiOptions: que1.options,
// 						},
// 					}
// 				)
// 					.then((que2) => {
// 						Question.findById('624c4ce0c4ab6f1a86e40154')
// 							.then((que3) => {
// 								Question.updateOne(
// 									{
// 										_id: ObjectId('624c4ce0c4ab6f1a86e40154'),
// 									},
// 									{
// 										$set: {
// 											type: QuestionTypes.LINKED_MCMC,
// 											multiOptions: que3.options,
// 										},
// 									}
// 								)
// 									.then((que4) => {
// 										res.send('all updated');
// 									})
// 									.catch((err) => res.send(err));
// 							})
// 							.catch((err) => res.send(err));
// 					})
// 					.catch((err) => res.send(err));
// 			})
// 			.catch((err) => res.send(err));
// 	}
// );

// tempRoutes.get('/core', sattleCorefor6);
// tempRoutes.get('/sattle', sattleSubmissions6);

export = tempRoutes;
