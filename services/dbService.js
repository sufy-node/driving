import Counter from '../models/Counter.js';

const getNextSequence = async (name) => {
    const counter = await Counter.findOneAndUpdate(
        { id: name },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
    );
    return counter.seq;
};

export const insertRecord = (Model, data) => new Model(data).save();

export const insertCompany = async (Model, data) => {
    const nextId = await getNextSequence('companyId');
    return new Model({ ...data, _id: nextId }).save();
};

export const insertVehicle = async (Model, data) => {
    const nextId = await getNextSequence('vehicleId');
    return new Model({ ...data, _id: nextId }).save();
};

// Simple find for small lists (Companies, Vehicles in dropdowns, etc.)
export const findRecords = (Model, query = {}, populate = '') => 
    Model.find(query).populate(populate).lean();

// Senior Level Pagination for large lists (Users, Sessions, Enrollments)
export const getPaginatedRecords = async (Model, query = {}, options = {}) => {
    const page = Math.max(1, parseInt(options.page) || 1);
    const limit = Math.max(1, parseInt(options.limit) || 20);
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
        Model.find(query)
            .sort(options.sort || { createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate(options.populate || '')
            .lean(),
        Model.countDocuments(query)
    ]);

    return {
        data,
        pagination: { total, page, limit, totalPages: Math.ceil(total / limit) }
    };
};

export const updateRecord = (Model, query, data) => 
    Model.findOneAndUpdate(query, data, { new: true, runValidators: true }).lean();

export const findOneRecord = (Model, query, populate = '') => 
    Model.findOne(query).populate(populate).lean();

export const findTenantRecords = (Model, companyId, query = {}) => 
    Model.find({ ...query, companyId }).lean();