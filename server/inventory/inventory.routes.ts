import { Router } from 'express';
import auth from '../middleware/auth';
import {
	addBrand,
	addProduct,
	archiveBrand,
	archiveProduct,
	getBrands,
	getUploadPolicy,
	getProducts,
	updateBrand,
	updateProduct,
	withClient,
	getVendors,
	addVendor,
	archiveVendor,
	updateVendorByKey,
	getVendorProfile,
} from './inventory.controller';

const inventoryRouter = Router();

inventoryRouter.use(auth.required, withClient);
inventoryRouter
	.route('/brands')
	.post(addBrand)
	.get(getBrands)
	.patch(updateBrand);

inventoryRouter.route('/brands/archive').get(archiveBrand);

inventoryRouter
	.route('/product')
	.get(getProducts)
	.post(addProduct)
	.patch(updateProduct);

inventoryRouter.route('/product/archive').get(archiveProduct);

inventoryRouter
	.route('/vendors')
	.get(getVendors)
	.post(addVendor)
	.patch(updateVendorByKey);

inventoryRouter.route('/vendors/archive').get(archiveVendor);

inventoryRouter.route('/vendors/profile').get(getVendorProfile);

inventoryRouter.route('/get-upload-policy').post(getUploadPolicy);

export = inventoryRouter;
