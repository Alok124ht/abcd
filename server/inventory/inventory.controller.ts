import { forEach, get, isArray, isNaN, toNumber, toString, trim } from 'lodash';
import { isValidObjectId } from 'mongoose';
import { getClientOfUser } from '../user/utils/user';
import InventoryProductModel from './models/inventory-product.model';
import InventoryBrandModel from './models/inventoy-brand.model';
import { OldPrices } from './types/InventoryProducts';
import qrcode from 'qrcode';
import { getRandomString } from '../utils/string';
import s3 from '../aws/s3';
import InventoryVendorModel from './models/inventory-vendor.model';
import { NextFunction } from 'express';

const superRoles = ['super', 'admin'];
const academicRoles = ['moderator', 'mentor'];
const organisationRoles = ['hr', 'moderator'];

export const withClient = async (
	req: ExpressRequest,
	res: ExpressResponse,
	next: NextFunction
) => {
	const { id: userId, role } = req.payload;
	if (superRoles.includes(role)) req.payload.client = undefined;
	else {
		const { client, error } = await getClientOfUser(userId);
		if (error)
			return res.send({
				success: false,
				msg: 'Sorry, you are not associated with any client!',
			});
		else req.payload.client = client._id;
	}
	next();
};

export const addBrand = (req: ExpressRequest, res: ExpressResponse) => {
	try {
		const { id: userId, role, client } = req.payload;
		const { name, image } = req.body;

		const isAdminAdding = superRoles.includes(role);

		if (!name) return res.send({ success: false, msg: 'Name is required' });

		const newBrand = new InventoryBrandModel({
			name,
			image,
			createdBy: userId,
			client: isAdminAdding ? undefined : client,
		});

		newBrand.save((err, saved) => {
			if (saved) res.send({ success: true, msg: 'Brand is added!' });
			else res.send({ success: false, msg: 'Brand is not added!' });
		});
	} catch (err) {
		return res.send({ success: false, msg: 'Error while updating product' });
	}
};

export const getBrands = (req: ExpressRequest, res: ExpressResponse) => {
	try {
		const { role, client: clientId } = req.payload;
		const { id: brandId, sort, keywords, skip, limit, mode } = req.query;
		let qskip = 0;
		let qlimit = 50;
		let qmode = mode || 'query';
		let sorting: any = { createdAt: -1 };
		const qkeywords = keywords ? toString(keywords) : '';

		const isAdmin = superRoles.includes(role);

		const query: any = {};
		if (!isAdmin) {
			if (Object.keys(query).includes('$or')) {
				query.$or.push({ client: clientId }, { client: undefined });
			} else query.$or = [{ client: clientId }, { client: undefined }];
			query.isArchived = { $ne: true };
		}

		if (qmode === 'query') {
			if (skip) {
				if (isNaN(toNumber(skip)))
					return res.send({ success: false, msg: 'Unappropriate skip value' });
				qskip = toNumber(skip);
			}

			if (limit) {
				if (isNaN(toNumber(limit)))
					return res.send({ success: false, msg: 'Unappropriate limit value' });
				qlimit = toNumber(limit);
			}

			if (brandId && !isValidObjectId(brandId))
				return res.send({
					success: false,
					msg: "please send valid id or don't sen it",
				});

			if (sort && !['asc', 'desc'].includes(toString(sort)))
				return res.send({
					success: false,
					msg: 'Sort must be asc or desc or undefined',
				});

			const query: any = {};
			if (sort === 'asc') sorting = { createdAt: 1 };
			if (sort === 'desc') sorting = { createdAt: -1 };

			if (qkeywords && trim(qkeywords) !== '') {
				if (isValidObjectId(qkeywords)) query._id = qkeywords;
				query.name = { $regex: qkeywords, $options: 'i' };
			}

			// if below condition is true then remove everything from query and just give id's matched record
			if (brandId) {
				forEach(Object.keys(query), (key) => {
					query[key] = undefined;
				});
				query._id = brandId;
			}

			const population = [
				{ path: 'createdBy', select: 'name username email mobileNumber dp role' },
			];

			if (isAdmin) {
				population.push({ path: 'client', select: 'name' });
			}

			InventoryBrandModel.find(query)
				.sort(sorting)
				.skip(qskip)
				.limit(qlimit)
				.populate(population)
				.then(async (brands) => {
					const total = await InventoryBrandModel.find(query).countDocuments();
					res.send({ success: true, brands, total });
				})
				.catch((err) => {
					res.send({
						success: false,
						msg: 'Error while fetching Brands!',
						err: err.message,
					});
				});
		} else {
			let ModelInstance = null;
			if (isAdmin) {
				ModelInstance = InventoryBrandModel.find(query)
					.select('name client')
					.populate({ path: 'client', select: 'name' });
			} else {
				ModelInstance = InventoryBrandModel.find(query).select('name');
			}

			ModelInstance.sort(sorting)
				.then((brands) => res.send({ success: true, brands }))
				.catch((err) =>
					res.send({
						success: false,
						msg: 'Error while fetching Brands!',
						err: err.message,
					})
				);
		}
	} catch (err) {
		return res.send({ success: false, msg: 'Error while updating product' });
	}
};

export const updateBrand = async (
	req: ExpressRequest,
	res: ExpressResponse
) => {
	try {
		const { role, client: clientId } = req.payload;
		const { id: brandId, name, image } = req.body;

		const isAdmin = superRoles.includes(role);

		if (!brandId || (brandId && !isValidObjectId(brandId)))
			return res.send({ success: false, msg: 'Please send proper Id' });

		if (!name && !image)
			return res.send({ success: false, msg: 'Name/Image must be sent' });

		const exist = await InventoryBrandModel.findById(brandId);

		if (!exist)
			return res.send({ success: false, msg: 'Brand not exist with Id you sent' });

		if (!isAdmin && toString(exist.client) !== toString(clientId))
			return res.send({
				success: false,
				msg: 'Brand is not associated to your client, you can not edit',
			});

		if (name) exist.set('name', name);
		if (image) exist.set('image', image);

		exist.save((err, saved) => {
			if (saved) res.send({ success: true, msg: 'Brand updated!' });
			else res.send({ success: false, msg: 'Brand update failed!' });
		});
	} catch (err) {
		return res.send({ success: false, msg: 'Error while updating product' });
	}
};

export const archiveBrand = async (
	req: ExpressRequest,
	res: ExpressResponse
) => {
	try {
		const { role, client: clientId } = req.payload;
		const { id: brandId, status } = req.query;
		const isArchived = status && (status === 'true' || status === '1');

		const isAdmin = superRoles.includes(role);

		if (!brandId)
			return res.send({ success: false, msg: 'Brand Id not passed!' });

		const exist = await InventoryBrandModel.findById(brandId);

		if (!exist)
			return res.send({ success: false, msg: 'Old brand not found with id' });

		if (!isAdmin) {
			if (toString(clientId) !== toString(exist.client))
				return res.send({
					success: false,
					msg: "You don't have access to edit brand",
				});
		}

		InventoryBrandModel.updateOne({ _id: brandId }, { isArchived })
			.then((updated) => {
				if (updated) res.send({ success: true, msg: 'Updated Successfully!' });
				else res.send({ success: false, msg: 'Failed to update brand' });
			})
			.catch((err) =>
				res.send({ success: false, msg: 'Error while updating brand!' })
			);
	} catch (err) {
		return res.send({ success: false, msg: 'Error while updating product' });
	}
};

export const addProduct = async (req: ExpressRequest, res: ExpressResponse) => {
	try {
		const { id: userId, role, client: clientId } = req.payload;
		const { name, description, price, brand, image } = req.body;

		const isAdminAdding = superRoles.includes(role);

		if (!name || !price || !brand)
			return res.send({ success: false, msg: 'Please send proper parameters!' });

		if (!isValidObjectId(brand))
			return res.send({ success: false, msg: 'Brand is not valid!' });

		const existBrand = await InventoryBrandModel.findById(brand);
		if (!existBrand)
			return res.send({ success: false, msg: 'Brand does not exist!' });

		if (!isAdminAdding)
			if (existBrand.client && toString(existBrand.client) !== toString(clientId))
				return res.send({ success: false, msg: 'Brand does not belong to client' });

		const newProduct = new InventoryProductModel({
			name,
			description,
			price,
			brand,
			client: isAdminAdding ? undefined : clientId,
			createdBy: userId,
			image,
		});

		newProduct.set(
			'qrcode',
			await qrcode.toString(toString(newProduct._id), {
				type: 'utf8',
				color: { light: '#EEE', dark: '#404040' },
			})
		);
		newProduct.save((err, saved) => {
			if (saved) res.send({ success: true, msg: 'Product saved!' });
			else res.send({ success: false, msg: 'Error while adding product' });
		});
	} catch (err) {
		return res.send({ success: false, msg: 'Error while updating product' });
	}
};

export const getProducts = (req: ExpressRequest, res: ExpressResponse) => {
	try {
		const { role, client: clientId } = req.payload;
		const { id: productId, keywords, skip, limit, sort, mode } = req.query;

		let qskip = 0;
		let qlimit = 50;
		let qmode = trim(toString(mode)) === '' ? 'query' : 'all';
		let qkeywords = keywords ? toString(keywords) : '';
		const query: any = {};
		const isAdmin = superRoles.includes(role);

		if (qmode === 'query') {
			let sorting: any = { createdAt: -1 };
			if (sort === 'asc') sorting = { createdAt: 1 };
			if (sort === 'desc') sorting = { createdAt: -1 };

			if (skip) {
				if (isNaN(toNumber(skip)))
					return res.send({ success: false, msg: 'Unappropriate skip value' });
				qskip = toNumber(skip);
			}

			if (limit) {
				if (isNaN(toNumber(limit)))
					return res.send({ success: false, msg: 'Unappropriate limit value' });
				qlimit = toNumber(limit);
			}

			if (qkeywords && trim(qkeywords) !== '') {
				query.$or = [];
				query.$or.push({ name: { $regex: qkeywords, $options: 'i' } });

				if (isValidObjectId(qkeywords)) {
					query.$or.push({ brand: qkeywords });
					query.$or.push({ _id: qkeywords });
				}
			}

			if (!isAdmin) {
				if (Object.keys(query).includes('$or')) {
					query.$or.push({ client: clientId });
					query.$or.push({ client: undefined });
				} else query.$or = [{ client: clientId }, { client: undefined }];
				query.isArchived = { $ne: true };
			}

			if (productId) {
				forEach(Object.keys(query), (key) => {
					query[key] = undefined;
				});
				query._id = productId;
			}

			const population = [
				{ path: 'createdBy', select: 'name username email dp mobileNumber role' },
				{ path: 'brand', select: 'name client' },
			];

			if (isAdmin) population.push({ path: 'client', select: 'name' });

			InventoryProductModel.find(query)
				.sort(sorting)
				.skip(qskip)
				.limit(qlimit)
				.populate(population)
				.then(async (products) => {
					const total = await InventoryProductModel.find(query).countDocuments();
					res.send({ success: true, products, total });
				})
				.catch((err) => {
					res.send({ success: false, msg: 'Error while fetching products' });
				});
		} else {
			const population = [{ path: 'brand', select: 'name' }];
			let selection = 'name brand';
			if (isAdmin) {
				population.push({ path: 'client', select: 'name' });
				selection += ' client';
			}
			InventoryProductModel.find(query)
				.select(selection)
				.populate(population)
				.sort({ createdAt: -1 })
				.then((products) => {
					res.send({ success: true, products });
				})
				.catch((err) => {
					res.send({ success: false, msg: 'Error while fetching products' });
				});
		}
	} catch (err) {
		return res.send({ success: false, msg: 'Error while updating product' });
	}
};

export const updateProduct = async (
	req: ExpressRequest,
	res: ExpressResponse
) => {
	try {
		const { role, client: clientId } = req.payload;
		const { id: productId, key, value } = req.body;

		const isAdminUpdating = superRoles.includes(role);

		if (!productId || (productId && !isValidObjectId(productId)) || !key)
			return res.send({
				success: false,
				msg: 'Please send valid parameters, either id or key not properly set',
			});

		const possibleKeys: string[] = [
			'name',
			'image',
			'qrcode',
			'price',
			'client',
			'brand',
			'description',
		];

		const keysWithValue: string[] = [
			'name',
			'image',
			'price',
			'brand',
			'client',
			'description',
		];
		const keysWithOutValue: string[] = ['qrcode'];

		if (!possibleKeys.includes(key))
			return res.send({ success: false, msg: 'Please send valid key' });

		if (keysWithValue.includes(key) && !value)
			return res.send({ success: false, msg: 'Value required for this key' });

		if (['client', 'brand'].includes(key) && !isAdminUpdating)
			return res.send({
				success: false,
				msg: `You are not authorize to update ${key}`,
			});

		const existProduct = await InventoryProductModel.findById(productId);
		if (!existProduct)
			return res.send({ success: false, msg: 'Product not found!' });

		if (!isAdminUpdating) {
			if (toString(existProduct.client) !== toString(clientId))
				return res.send({
					success: false,
					msg: 'Product is not associated with your client',
				});
		}

		if (key === 'price') {
			let prices: OldPrices[] = [];
			if (existProduct.oldPrices) prices = existProduct.oldPrices;
			prices.push({ price: existProduct.price, effectiveTill: new Date() });
			existProduct.set('oldPrices', prices);
		}

		if (keysWithValue.includes(key)) existProduct.set(key, value);
		else if (keysWithOutValue.includes(key)) {
			if (key === 'qrcode') {
				const qr = await qrcode.toString(toString(existProduct._id), {
					type: 'utf8',
					color: { light: '#EEE', dark: '#404040' },
				});
				existProduct.set('qrcode', qr);
			}
		}

		existProduct.save((err, saved) => {
			const population = [
				{ path: 'createdBy', select: 'name username email dp mobileNumber' },
			];
			if (isAdminUpdating) population.push({ path: 'client', select: 'name ' });

			if (saved)
				InventoryProductModel.findById(saved._id)
					.populate(population)
					.then((item) => res.send({ success: true, product: item }))
					.catch((err) =>
						res.send({ success: false, msg: 'Error while getting new data' })
					);
			else res.send({ success: false, msg: 'Error while updating item' });
		});
	} catch (err) {
		return res.send({ success: false, msg: 'Error while updating product' });
	}
};

export const archiveProduct = async (
	req: ExpressRequest,
	res: ExpressResponse
) => {
	try {
		const { role, client: clientId } = req.payload;
		const { id: productId, status } = req.query;
		let isArchived = false;
		const isAdmin = superRoles.includes(role);

		if (!productId || (productId && !isValidObjectId(productId)))
			return res.send({ success: false, msg: 'Please send proper id!' });

		if (status && (status === 'true' || status === '1')) isArchived = true;

		const existProduct = await InventoryProductModel.findById(productId);

		if (!existProduct)
			return res.send({ success: false, msg: "Product doesn't exist!" });

		if (!isAdmin) {
			if (toString(clientId) !== toString(existProduct.client))
				return res.send({
					success: false,
					msg: "You don't have access to archive this product!",
				});
		}

		existProduct.set('isArchived', isArchived);
		existProduct.save((err, saved) => {
			if (saved) return res.send({ success: true, msg: 'Product Updated!' });
			else return res.send({ success: false, msg: 'Failed to upate product!' });
		});
	} catch (err) {
		return res.send({ success: false, msg: 'Error while updating product' });
	}
};

export const getUploadPolicy = (req: ExpressRequest, res: ExpressResponse) => {
	const { id: userId } = req.payload;
	const { mime, type } = req.body;
	const fileName = getRandomString(24);
	const filePath = `${process.env.AWS_LEARNING_CENTER_DOCUMENTS_BASE_PATH}/${
		type ? `inventory/${type}` : 'inventory'
	}/u/${userId}/${getRandomString(24)}/${fileName}`;
	return s3.createPresignedPost(
		{
			Bucket: process.env.AWS_LEARNING_CENTER_DOCUMENTS_BUCKET,
			Expires: 3600,
			Conditions: [{ key: filePath }],
			Fields: { acl: 'public-read', key: filePath, mime, 'content-type': mime },
		},
		(error: Error, data: any) => {
			if (error) {
				res.send({ success: false, message: 'Unable to create policy', error });
			} else {
				res.send({ success: true, data, filePath, fileName });
			}
		}
	);
};

export const addVendor = (req: ExpressRequest, res: ExpressResponse) => {
	const {
		name,
		contactNo,
		email,
		website,
		address,
		brands,
		otherMobiles,
		otherEmails,
		socialHandles,
		client: clientFromRequest,
	} = req.body;
	const { id: userId, client: clientId, role } = req.payload;

	const isAdmin = superRoles.includes(role);

	if (
		!name ||
		(!contactNo && !email) ||
		!brands ||
		(brands && (!isArray(brands) || brands.length === 0))
	)
		return res.send({
			success: false,
			msg: 'Please provide appropriate parameters!',
		});

	const vendor = new InventoryVendorModel({
		client: isAdmin ? clientFromRequest : clientId,
		createdBy: userId,
		contactNo,
		name,
		email,
		website,
		address,
		brands,
		otherEmails,
		otherMobiles,
		socialHandles,
	});

	vendor.save((err) => {
		if (err) res.send({ success: false, msg: 'Error while adding vendor!' });
		else res.send({ success: true, msg: 'Vendor addded!' });
	});
};

export const getVendors = (req: ExpressRequest, res: ExpressResponse) => {
	const { role, client: clientId } = req.payload;
	const {
		id: vendorId,
		keywords,
		limit,
		skip,
		sort = 'desc',
		mode = 'query',
	} = req.query;

	const isAdmin = superRoles.includes(role);
	const query: any = {};
	if (!isAdmin) {
		query.client = clientId;
		query.isArchived = { $ne: true };
	}

	if (mode === 'query') {
		const qkeywords = trim(toString(keywords)) === '' ? null : toString(keywords);
		const qlimit = limit ? toNumber(limit) : 50;
		const qskip = skip ? toNumber(skip) : 0;

		if (isNaN(qlimit))
			return res.send({ success: false, msg: 'Please sent proper limit value!' });
		if (isNaN(qskip))
			return res.send({ success: false, msg: 'Please sent proper skip value!' });
		if (qkeywords) {
			const regex = { $regex: qkeywords, $options: 'i' };
			query.$or = [
				{ name: regex },
				{ contactNo: regex },
				{ email: regex },
				{ website: regex },
				{ 'socialHandles.value': regex },
				{ otherMobiles: regex },
				{ otherEmails: regex },
			];
			if (isValidObjectId(keywords)) {
				if (isAdmin) query.$or.push({ client: qkeywords });
				query.$or.push({ _id: qkeywords });
				query.$or.push({ brands: qkeywords });
			}
		}
		if (vendorId && trim(toString(vendorId)) !== '') {
			if (isValidObjectId(vendorId)) {
				forEach(Object.keys(query), (key) => {
					query[key] = undefined;
				});
				query._id = vendorId;
			} else {
				return res.send({
					success: false,
					msg: 'Please send proper id if you want to see individual result',
				});
			}
		}

		const population = [
			{ path: 'brands', select: 'name' },
			{ path: 'oldBrands', select: 'name' },
			{ path: 'createdBy', select: 'name role dp email username' },
		];

		if (isAdmin) population.push({ path: 'client', select: 'name' });

		InventoryVendorModel.find(query)
			.populate(population)
			.skip(qskip)
			.limit(qlimit)
			.sort(sort === 'asc' ? { createdAt: 1 } : { createdAt: -1 })
			.then(async (vendors) => {
				const total = await InventoryVendorModel.find(query).countDocuments();
				res.send({ success: true, vendors, total });
			})
			.catch((err) => {
				console.log(err);
				res.send({ success: false, msg: 'Error while fetching vendors!' });
			});
	} else {
		const population = [{ path: 'brands', select: 'name' }];
		let selection = 'name brands';
		if (isAdmin) {
			population.push({ path: 'client', select: 'name' });
			selection += ' client';
		}
		InventoryVendorModel.find(query)
			.select(selection)
			.sort({ createdAt: -1 })
			.then((vendors) => {
				res.send({ success: true, vendors });
			})
			.catch((err) =>
				res.send({ success: false, msg: 'Error while fetching vendors!' })
			);
	}
};

export const updateVendorByKey = async (
	req: ExpressRequest,
	res: ExpressResponse
) => {
	const { role, client: clientId } = req.payload;
	const { key, value, id: vendorId } = req.body;
	const isAdmin = superRoles.includes(role);

	const allowedKeys = [
		'name',
		'email',
		'contactNo',
		'brands',
		'client',
		'website',
	];
	if (!allowedKeys.includes(key))
		return res.send({ success: false, msg: 'Invalid Key!' });
	if (!value || trim(value) === '')
		return res.send({ success: false, msg: 'Value is required!' });
	if (!vendorId || !isValidObjectId(vendorId))
		return res.send({ success: false, msg: 'Id is invalid!' });

	const existing = await InventoryVendorModel.findById(vendorId);

	if (!existing) return res.send({ success: false, msg: 'Vendor not found!' });
	if (!isAdmin && toString(existing.client) !== toString(clientId))
		return res.send({ success: false, msg: "you don't have access" });
	if (key === 'brands' && !isArray(value))
		return res.send({ success: false, msg: 'Brands must be array!' });

	existing.set(key, value);

	existing.save((err, saved) => {
		if (saved) res.send({ success: true, msg: 'Vendor Updated!' });
		else res.send({ success: false, msg: 'Failed to update Vendor!' });
	});
};

export const archiveVendor = async (
	req: ExpressRequest,
	res: ExpressResponse
) => {
	const { id: vendorId, status } = req.query;
	const { role, client: clientId } = req.payload;
	const isAdmin = superRoles.includes(role);
	const qstatus = toString(status);
	let set = false;

	if (!vendorId || trim(toString(vendorId)) === '')
		return res.send({ success: false, msg: 'id is required!' });

	const existing = await InventoryVendorModel.findById(vendorId);

	if (!existing) return res.send({ success: false, msg: 'Vendor not found!' });
	if (!isAdmin && toString(existing.client) !== toString(clientId))
		return res.send({ success: false, msg: "You don't have access" });

	if (
		qstatus === 'true' ||
		toNumber(qstatus) === 1 ||
		(typeof status === 'boolean' && status === true)
	)
		set = true;

	existing.set('isArchived', set);
	existing.save((err, saved) => {
		if (saved)
			return res.send({ success: true, msg: 'Vendor visibility changed!' });
		else
			return res.send({ success: false, msg: 'Error while updating visibility!' });
	});
};

export const getVendorProfile = (req: ExpressRequest, res: ExpressResponse) => {
	const { id: vendorId } = req.query;

	if (!vendorId || !isValidObjectId(vendorId))
		return res.send({ success: false, msg: 'Id is not sent!' });
	InventoryVendorModel.findById(vendorId)
		.populate([
			{
				path: 'brands',
				select: 'name client',
				populate: { path: 'client', select: 'name' },
			},
			{ path: 'createdBy', select: 'username role name email mobileNumber' },
			{ path: 'client', select: 'name' },
		])
		.then((vendor) => {
			if (vendor) res.send({ success: true, vendor });
			else res.send({ success: false, msg: 'Vendor not found!' });
		})
		.catch((err) => {
			console.log(err);
			res.send({ success: false, msg: 'Error while getting details!' });
		});
};
