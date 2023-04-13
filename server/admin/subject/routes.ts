import { Router } from 'express';
import auth from '../../middleware/auth';
import { createSubject, listSubjects, updateSubject } from './controller';

const subjectRouter = Router();

subjectRouter.route('/list').get(listSubjects);
subjectRouter.route('/create').post(auth.isSuper, createSubject);
subjectRouter.route('/update').patch(auth.isSuper, updateSubject);

export default subjectRouter;
