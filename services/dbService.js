import Counter from '../models/Counter.js';

/**
 * Helper to get next sequence for Auto-Increment
 */
const getNextSequence = async (name) => {
    const counter = await Counter.findOneAndUpdate(
        { id: name },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
    );
    return counter.seq;
};

export const insertRecord = async (Model, data) => {
    const record = new Model(data);
    return await record.save();
};

// Specific helper for Company to handle Auto-Increment
export const insertCompany = async (Model, data) => {
    const nextId = await getNextSequence('companyId');
    const record = new Model({ ...data, _id: nextId });
    return await record.save();
};

export const findRecords = async (Model, query = {}, populate = '') => {
    return await Model.find(query).populate(populate).lean();
};

export const findOneRecord = async (Model, query = {}, populate = '') => {
    return await Model.findOne(query).populate(populate).lean();
};

export const updateRecord = async (Model, query, data) => {
    return await Model.findOneAndUpdate(query, data, { new: true, runValidators: true });
};

export const findTenantRecords = async (Model, companyId, query = {}) => {
    return await Model.find({ ...query, companyId }).lean();
};