import moment from 'moment';
import { Response } from 'express';
import { FilterQuery, Types } from 'mongoose';
import { forEach, has, map, some } from 'lodash';
import { Request } from '../../types/Request';
import { getGroupsOfUser } from '../../cache/UserGroups';
import PlaylistModel from '../models/Playlist';
import { Playlist } from '../../types/Playlist';
import PlaylistItemModel from '../models/PlaylistItem';
import s3 from '../../aws/s3';
import { PlaylistItem } from '../../types/PlaylistItem';
import SubjectModel from '../../models/Subject';
import { TagList } from '../../types/Tag';
import { isAtLeast } from '../../utils/user/role';
import { UserRole } from '../../user/IUser';
import UserVideoStat from '../models/UserVideoStat';
import { parseAsString } from '../../utils/query';
var mongoose = require('mongoose');

const { ObjectId } = Types;

export async function createPlaylist(
	req: ExpressRequest,
	res: ExpressResponse
) {
	const { id: userId } = req.payload;
	const {
		title,
		description,
		accessibleTo,
		settingId,
		thumbNailsUrls,
		resourceType,
		permissions,
		subject: subjectId,
	} = req.body;
	const tags: TagList = Array.isArray(req.body.tags) ? req.body.tags : [];
	const updatedPermissions = [{ item: new ObjectId(userId), itemType: 'User' }];
	if (Array.isArray(permissions)) {
		permissions.forEach((permission) => {
			if (['User', 'UserGroup'].includes(permission.itemType) && permission.item) {
				updatedPermissions.push({
					item: permission,
					itemType: permission.itemType,
				});
			}
		});
	}
	if (subjectId) {
		const subject = await SubjectModel.findById(subjectId);
		if (subject) {
			let subjectTagIndex = -1;
			forEach(tags, (tag, index) => {
				if (tag.key === 'Subject') {
					subjectTagIndex = index;
				}
			});
			if (subjectTagIndex === -1) {
				tags.push({ key: 'Subject', value: subject.name });
			}
		}
	}
	const playlist = new PlaylistModel({
		createdBy: userId,
		title,
		accessibleTo,
		description,
		setting: settingId,
		tags,
		thumbNailsUrls,
		resourceType,
		permissions: updatedPermissions,
		subject: subjectId,
	});
	playlist.save((error, savedPlaylist) => {
		if (error) {
			res
				.status(422)
				.send({ message: 'Some error occurred', error: error.message });
		} else {
			res.send(savedPlaylist);
		}
	});
}

export async function updatePlaylist(
	req: ExpressRequest,
	res: ExpressResponse
) {
	const playlistId = req.params.id;
	const {
		title,
		description,
		permissions,
		settingId,
		thumbNailsUrls,
		serviceMachineNames,
		serviceMachineNamesRequired,
	} = req.body;

	try {
		const playlist = await PlaylistModel.findOne({ _id: playlistId });

		if (!playlist) {
			res.status(404).send({ message: 'Playlist not found.' });
		} else {
			if (title) {
				playlist.set('title', title);
			}
			if (typeof description !== 'undefined') {
				playlist.set('description', description);
			}
			if (typeof settingId !== 'undefined') {
				playlist.set('setting', settingId);
			}
			if (has(req.body, 'tags')) {
				const tags: TagList = Array.isArray(req.body.tags) ? req.body.tags : [];
				playlist.set('tags', tags);
			}
			if (typeof thumbNailsUrls !== 'undefined') {
				playlist.set('thumbNailsUrls', thumbNailsUrls);
			}
			if (
				serviceMachineNamesRequired === true ||
				serviceMachineNamesRequired === 1 ||
				serviceMachineNamesRequired === '1'
			) {
				playlist.set('serviceMachineNamesRequired', true);
				playlist.set('serviceMachineNames', serviceMachineNames);
			} else {
				playlist.set('serviceMachineNamesRequired', false);
			}
			if (has(req.body, 'permissions')) {
				playlist.set('permissions', permissions);
			}
			if (has(req.body, 'subject')) {
				const subjectId = req.body.subject;
				playlist.set('subject', subjectId);
				const subject = await SubjectModel.findById(subjectId);
				if (subject) {
					let subjectTagIndex = -1;
					forEach(playlist.tags, (tag, index) => {
						if (tag.key === 'Subject') {
							subjectTagIndex = index;
						}
					});
					if (subjectTagIndex === -1) {
						playlist.tags.push({ key: 'Subject', value: subject.name });
					}
				}
			}
			playlist.save((saveError) => {
				if (saveError) {
					res
						.status(422)
						.send({ message: 'Failed to update', error: saveError.message });
				} else {
					res.send({ playlist });
				}
			});
		}
	} catch (searchError) {
		res
			.status(500)
			.send({ message: 'Internal Server Error', error: searchError.message });
	}
}

export const removeItemFromPlaylist = (req: Request, res: Response) => {
	const { playlistItemId, playlistId } = req.body;
	PlaylistModel.findOne({ _id: playlistId }).exec((searchError, playlist) => {
		if (searchError) {
			res.status(500).send({ message: 'Internal Server Error' });
		} else if (!playlist) {
			res.status(422).send({ message: 'Invalid Playlist ID' });
		} else {
			playlist.set(
				'items',
				playlist.items.filter((item) => !item.equals(playlistItemId))
			);
			playlist.save((saveError) => {
				if (saveError) {
					res.status(500).send({ message: 'Failed to update' });
				} else {
					res.send({ playlist });
				}
			});
		}
	});
};

export const removeItemsFromPlaylist = (req: Request, res: Response) => {
	const { playlistItemIds, playlistId } = req.body;
	if (!Array.isArray(playlistItemIds) || !playlistId) {
		res.status(422).send({ message: 'Invalid params' });
	} else {
		PlaylistModel.findOne({ _id: playlistId }).exec((searchError, playlist) => {
			if (searchError) {
				res.status(500).send({ message: 'Internal Server Error' });
			} else if (!playlist) {
				res.status(422).send({ message: 'Invalid Playlist ID' });
			} else {
				playlist.set(
					'items',
					playlist.items.filter(
						(item) =>
							!playlistItemIds.some((playlistItemId) => item.equals(playlistItemId))
					)
				);
				playlist.save((saveError) => {
					if (saveError) {
						res.status(500).send({ message: 'Failed to update' });
					} else {
						res.send({ playlist });
					}
				});
			}
		});
	}
};

export const addItemsToPlaylist = (req: Request, res: Response) => {
	const { items, id: playlistId } = req.body;
	const { id: userId } = req.payload;
	PlaylistModel.findOne({ _id: playlistId }).exec((searchError, playlist) => {
		if (searchError) {
			res.status(500).send({ message: 'Internal Server Error' });
		} else if (!playlist) {
			res
				.status(422)
				.send({ message: 'Invalid Playlist ID', userId, playlistId, playlist });
		} else {
			PlaylistItemModel.create(
				items.map((item: any) => {
					const {
						availableTill,
						availableFrom,
						resource,
						availableFromByPhase,
						availableTillByPhase,
					} = item;
					return {
						availableFrom,
						availableTill,
						availableFromByPhase,
						availableTillByPhase,
						resource,
						resourceModel: playlist.resourceType,
						createdBy: userId,
					};
				}),
				(error: any, playlistItems: PlaylistItem[]) => {
					if (error) {
						res.status(422).send({
							message: 'Error occurred while creating PlaylistItems',
							error: error.message,
						});
					} else {
						playlistItems.forEach((playlistItem) => {
							playlist.items.push(playlistItem._id);
						});
						playlist.save((playlistSaveError) => {
							if (playlistSaveError) {
								res.status(500).send({
									message: 'Internal Server Error',
									error: playlistSaveError.message,
								});
							} else {
								res.send({ playlist });
							}
						});
					}
				}
			);
		}
	});
};

export const upadtePlaylistItem = (req: Request, res: Response) => {
	const {
		playlistItemId,
		playlistId,
		availableFrom,
		availableTill,
		availableFromByPhase,
		availableTillByPhase,
	} = req.body;
	PlaylistModel.findOne({ _id: playlistId })
		.select('items')
		.exec((error, playlist) => {
			if (error) {
				res.status(500).send({ message: 'Internal Server Error' });
			} else if (!playlist) {
				res.status(422).send({ message: 'Invalid params' });
			} else if (playlist.items.some((item) => item.equals(playlistItemId))) {
				PlaylistItemModel.findOne({ _id: playlistItemId }).exec(
					(searchError, playlistItem) => {
						if (searchError) {
							res.status(500).send({ message: 'Internal Server Error' });
						} else if (!playlistItem) {
							res.status(422).send({ message: 'PlaylistItem not found' });
						} else {
							const availableFromByPhaseDate: { [phase: string]: Date } = {};
							forEach(availableFromByPhase, (date, phase) => {
								availableFromByPhaseDate[phase] = moment(date).toDate();
							});
							const availableTillByPhaseDate: { [phase: string]: Date } = {};
							forEach(availableTillByPhase, (date, phase) => {
								availableTillByPhaseDate[phase] = moment(date).toDate();
							});
							playlistItem.set('availableFrom', availableFrom);
							playlistItem.set('availableTill', availableTill);
							playlistItem.set('availableFromByPhase', availableFromByPhaseDate);
							playlistItem.set('availableTillByPhase', availableTillByPhaseDate);
							playlistItem.save((saveError) => {
								if (saveError) {
									res.status(500).send({
										message: 'Error occurred while updating PlaylistItem',
										error: saveError.message,
									});
								} else {
									res.send(playlistItem);
								}
							});
						}
					}
				);
			} else {
				res.status(422).send({ message: 'Invalid Params' });
			}
		});
};

export const addToAccessibleList = (req: Request, res: Response) => {
	const { id: playlistId, items } = req.body;
	PlaylistModel.findOne({ _id: playlistId }).exec((searchError, playlist) => {
		if (searchError) {
			res.status(500).send({ message: 'Internal Server Error' });
		} else if (!playlist) {
			res.status(404).send({ message: 'Playlist not found' });
		} else {
			const duplicates: { type: any; value: any }[] = [];
			items.forEach((item: { type: any; value: any }) => {
				const isDuplicate =
					playlist.accessibleTo.filter(
						(i) => i.value.equals(item.value) && i.type === item.type
					).length > 0;
				if (!isDuplicate) {
					playlist.accessibleTo.push(item);
				} else {
					duplicates.push(item);
				}
			});
			playlist.save((updateError) => {
				if (updateError) {
					res
						.status(422)
						.send({ message: 'Failed to update', error: updateError.message });
				} else {
					res.send({ playlist, duplicates });
				}
			});
		}
	});
};

export const updateAccessibleTo = (req: Request, res: Response) => {
	const { id: playlistId, items } = req.body;
	PlaylistModel.findOne({ _id: playlistId }).exec((searchError, playlist) => {
		if (searchError) {
			res.status(500).send({ message: 'Internal Server Error' });
		} else if (!playlist) {
			res.status(404).send({ message: 'Playlist not found' });
		} else {
			const newAccessibilityList = playlist.accessibleTo.filter(
				(accessibleToItem) =>
					some(
						items,
						(item) =>
							accessibleToItem.value.equals(item.value) &&
							accessibleToItem.type === item.type
					)
			);
			const duplicates: { type: any; value: any }[] = [];
			items.forEach((item: { type: any; value: any }) => {
				const isDuplicate =
					playlist.accessibleTo.filter(
						(i) => i.value.equals(item.value) && i.type === item.type
					).length > 0;
				if (!isDuplicate) {
					newAccessibilityList.push(item);
				} else {
					duplicates.push(item);
				}
			});
			playlist.set('accessibleTo', newAccessibilityList);
			playlist.save((updateError) => {
				if (updateError) {
					res
						.status(422)
						.send({ message: 'Failed to update', error: updateError.message });
				} else {
					res.send({ playlist, duplicates });
				}
			});
		}
	});
};

export const getMyPlaylists = async (req: Request, res: Response) => {
	const { id: userId, role } = req.payload;
	const query: FilterQuery<Playlist> = {};
	if (!isAtLeast(UserRole.ADMIN, role)) {
		let groupIdsOfUser;
		try {
			groupIdsOfUser = await getGroupsOfUser(userId);
		} finally {
			const orCondition: FilterQuery<Playlist> = [
				{
					itemType: 'User',
					item: ObjectId(userId),
				},
			];
			if (Array.isArray(groupIdsOfUser) && groupIdsOfUser.length) {
				orCondition.push({
					itemType: 'UserGroup',
					item: { $in: map(groupIdsOfUser, (id) => ObjectId(id)) },
				});
			}
			query.permissions = {
				$elemMatch: {
					$or: orCondition,
				},
			};
		}
	}
	PlaylistModel.find(query)
		.sort({ _id: -1 })
		.populate([{ path: 'permissions.item', select: 'label name email' }])
		.exec((searchError, playlists) => {
			if (searchError) {
				res.status(500).send({ message: 'Internal Server Error' });
			} else {
				res.send({ items: playlists });
			}
		});
};

export const getMyPlaylist = (req: Request, res: Response) => {
	const { id } = req.params;
	PlaylistModel.findOne({ _id: id })
		.populate([
			{
				path: 'items',
				populate: [{ path: 'resource' }],
				select:
					'resource resourceModel availableFrom availableTill availableFromByPhase availableTillByPhase',
			},
			{
				path: 'setting',
			},
		])
		.exec((searchError, playlist) => {
			if (searchError) {
				res.status(500).send({ message: 'Internal Server Error', searchError });
			} else if (!playlist) {
				res.status(404).send({ message: 'Playlist not found' });
			} else {
				res.send({ playlist });
			}
		});
};

export const createPolicyForPlaylistIcon = (req: Request, res: Response) => {
	const { mime, fileName, playlistId } = req.body;
	const filePath = `${process.env.AWS_LEARNING_CENTER_DOCUMENTS_BASE_PATH}/u/playlist/icons/${playlistId}/${fileName}`;
	return s3.createPresignedPost(
		{
			Bucket: process.env.AWS_LEARNING_CENTER_DOCUMENTS_BUCKET,
			Expires: 3600,
			Conditions: [{ key: filePath }],
			Fields: { acl: 'public-read', key: filePath, mime },
		},
		(error, data) => {
			if (error) {
				res.status(422).send({ message: 'Unable to create policy', error });
			} else {
				res.send({ data, filePath });
			}
		}
	);
};

export const removeFromAccessibleList = (req: Request, res: Response) => {
	const { id: playlistId, items } = req.body;
	PlaylistModel.findOne({ _id: playlistId }).exec((searchError, playlist) => {
		if (searchError) {
			res.status(500).send({ message: 'Internal Server Error' });
		} else if (!playlist) {
			res.status(404).send({ message: 'Playlist not found' });
		} else {
			const newAccessibilityList = playlist.accessibleTo.filter(
				(accessibleToItem) =>
					!items.some((item: { type: any; value: any }) => {
						if (
							accessibleToItem.value.equals(item.value) &&
							accessibleToItem.type === item.type
						) {
							return true;
						}
						return false;
					})
			);
			playlist.set('accessibleTo', newAccessibilityList);
			playlist.save((updateError) => {
				if (updateError) {
					res
						.status(422)
						.send({ message: 'Failed to update', error: updateError.message });
				} else {
					res.send({ playlist });
				}
			});
		}
	});
};

export const getVideoProgress = async (req: Request, res: Response) => {
	const videoId = parseAsString(req.query.videoId);
	const { id: userId } = req.payload;
	const stats = await UserVideoStat.aggregate([
		{
			$match: {
				u: new mongoose.Types.ObjectId(userId),
				v: new mongoose.Types.ObjectId(videoId),
			},
		},
	]);
	res.send(stats);
};
