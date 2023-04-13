import { IUser } from '../user/IUser';
import {
	DiscussionDocument,
	SubThreadItem,
	ThreadItem,
} from './discussion.model';

export function checkedUsername(username: string) {
	if (username.indexOf('NOTSET') >= 0) return 'Prepseed-User';
	return username;
}

export function secureDiscussion(discussion: DiscussionDocument) {
	interface SecureUser {
		dp: string;
		username: string;
	}
	type SubThreadSecure = Pick<SubThreadItem, '_id' | 'text'> & {
		user: SecureUser;
	};
	type ThreadSecure = Pick<
		ThreadItem,
		'_id' | 'kind' | 'text' | 'upvotes' | 'downvotes'
	> & {
		user: SecureUser;
		threads: SubThreadSecure[];
	};
	const secureThreads: ThreadSecure[] = [];
	discussion.threads.forEach((t) => {
		if (!t.isDeleted) {
			const replies: SubThreadSecure[] = [];
			t.threads.forEach((tt) => {
				if (!tt.isDeleted) {
					const user = tt.user as unknown as IUser;
					replies.push({
						_id: tt._id,
						text: tt.text,
						user: {
							dp: user.dp,
							username: checkedUsername(user.username),
						},
					});
				}
			});
			const user = t.user as unknown as IUser;
			secureThreads.push({
				_id: t._id,
				kind: t.kind,
				text: t.text,
				upvotes: t.upvotes,
				downvotes: t.downvotes,
				user: {
					dp: user.dp,
					username: checkedUsername(user.username),
				},
				threads: replies,
			});
		}
	});
	const securedDiscussion = {
		_id: discussion._id,
		id: discussion.id,
		threads: secureThreads,
	};
	return securedDiscussion;
}
