import { Document, Model, Types } from 'mongoose';

interface UserVideoStatBase {
	/**
	 * alias for video
	 */
	video: Types.ObjectId;
	/**
	 * short name of video
	 */
	v: Types.ObjectId;
	/**
	 * alias for u
	 */
	user: Types.ObjectId;
	/**
	 * short name of user
	 */
	u: Types.ObjectId;
	/**
	 * alias for i
	 */
	plays: { from: Date; till: Date; device?: string }[];
	/**
	 * play details
	 */
	i: { from: Date; till: Date; device?: string }[];
	/**
	 * Did Join live,
	 * alias for djl
	 */
	didJoinLive: boolean;
	/**
	 * Did join live,
	 * short form of didJoinLive
	 */
	djl: boolean;
	/**
	 * alias of iw
	 */
	isWatched: boolean;
	/**
	 * is video watched
	 */
	iw: boolean;
	/**
	 * alias of wt
	 */
	watchTime: number;
	/**
	 * total watch time
	 */
	wt: number;
	/**
	 * Last position, in seconds from start of the video
	 */
	lastPosition: number;
	createdAt: Date;
	updatedAt: Date;
}
interface UserVideoStat extends UserVideoStatBase, Document {}

interface UserVideoStatModelInterface extends Model<UserVideoStat> {}
