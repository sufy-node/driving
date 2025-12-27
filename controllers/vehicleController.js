import Vehicle from '../models/Vehicle.js';
import { insertVehicle, getPaginatedRecords, updateRecord, findOneRecord } from '../services/dbService.js';
import { catchAsync, AppError } from '../utils/appError.js';

/**
 * GET Vehicles List with Modern Pagination
 */
export const getVehiclesPage = catchAsync(async (req, res, next) => {
    const companyId = req.tenant._id;
    const page = req.query.page || 1;

    const result = await getPaginatedRecords(Vehicle, { companyId }, { 
        page, 
        limit: 10, 
        sort: { name: 1 } 
    });

    res.render('company/vehicles', {
        title: 'Vehicle Fleet Management',
        vehicles: result.data,
        pagination: result.pagination,
        tenant: req.tenant,
        user: req.user
    });
});

/**
 * GET Edit Vehicle Page
 * Securely fetches a vehicle belonging ONLY to the current company
 */
export const getEditVehiclePage = catchAsync(async (req, res, next) => {
    const vehicleId = Number(req.params.id);
    const companyId = req.tenant._id;

    const vehicle = await findOneRecord(Vehicle, { _id: vehicleId, companyId });

    if (!vehicle) {
        return next(new AppError('Vehicle not found or you do not have permission to edit it.', 404));
    }

    res.render('company/editVehicle', {
        title: `Edit Vehicle: ${vehicle.name}`,
        vehicle,
        tenant: req.tenant,
        user: req.user
    });
});

/**
 * POST Update Vehicle
 */
export const updateVehicle = catchAsync(async (req, res, next) => {
    const vehicleId = Number(req.params.id);
    const companyId = req.tenant._id;
    const { name, plateNumber, isActive } = req.body;

    if (!name || !plateNumber) {
        return next(new AppError('Vehicle name and plate number are required.', 400));
    }

    const updated = await updateRecord(Vehicle, 
        { _id: vehicleId, companyId }, 
        { 
            name: name.trim(), 
            plateNumber: plateNumber.toUpperCase().trim(), 
            isActive: isActive === 'on' 
        }
    );

    if (!updated) {
        return next(new AppError('Failed to update vehicle. It may have been deleted.', 404));
    }

    res.redirect(res.locals.tenantUrl('/vehicles?success=Vehicle updated successfully'));
});

/**
 * POST Add Vehicle
 */
export const addVehicle = catchAsync(async (req, res, next) => {
    const { name, plateNumber } = req.body;
    const companyId = req.tenant._id;

    if (!name || !plateNumber) {
        return next(new AppError('Please provide both vehicle name and plate number', 400));
    }

    await insertVehicle(Vehicle, {
        companyId,
        name: name.trim(),
        plateNumber: plateNumber.toUpperCase().trim()
    });

    res.redirect(res.locals.tenantUrl('/vehicles?success=New vehicle added to fleet'));
});

/**
 * POST Toggle Vehicle Status
 */
export const toggleVehicleStatus = catchAsync(async (req, res, next) => {
    const vehicleId = Number(req.params.id);
    const companyId = req.tenant._id;

    const vehicle = await findOneRecord(Vehicle, { _id: vehicleId, companyId });

    if (!vehicle) return next(new AppError('Vehicle not found', 404));

    await updateRecord(Vehicle, { _id: vehicleId }, { isActive: !vehicle.isActive });

    res.redirect(res.locals.tenantUrl('/vehicles?success=Vehicle status updated'));
});