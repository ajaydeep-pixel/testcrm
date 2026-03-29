
import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { brandsAPI, categoriesAPI, productsAPI, subcategoriesAPI } from '../../services/api';

const steps = [
  ['identity', 'Identity', 'Name, category, references'],
  ['pricing', 'Pricing', 'Price, tax, discount setup'],
  ['inventory', 'Inventory', 'Stock rules and status'],
  ['details', 'Details', 'Descriptions, tags, media'],
];

const blank = {
  name: '',
  description: '',
  sku: '',
  brandId: '',
  categoryId: '',
  subCategoryId: '',
  model: '',
  referenceCode: '',
  barcode: '',
  unitOfMeasure: '',
  sellingPrice: '',
  purchasePrice: '',
  mrp: '',
  discountPercent: '',
  maxDiscountPercent: '',
  hsnCode: '',
  gstPercent: '',
  taxType: 'GST',
  status: 'active',
  warrantyPeriod: '',
  minStock: '',
  maxStock: '',
  availableStock: '',
  expiryDate: '',
  tagsText: '',
  imageData: '',
};

const numericField = (label) =>
  yup
    .number()
    .transform((value, originalValue) => (originalValue === '' || originalValue == null ? undefined : value))
    .typeError(`${label} must be a valid number`)
    .min(0, `${label} must be non-negative`);

const schema = yup.object({
  name: yup.string().trim().required('Product name is required'),
  brandId: yup.string().trim().required('Brand is required'),
  categoryId: yup.string().trim().required('Category is required'),
  subCategoryId: yup.string().nullable(),
  sellingPrice: numericField('Selling price').required('Selling price is required'),
  purchasePrice: numericField('Purchase price').required('Purchase price is required'),
  mrp: numericField('MRP').nullable(),
  discountPercent: numericField('Discount %').nullable(),
  maxDiscountPercent: numericField('Max discount %').nullable(),
  gstPercent: numericField('GST %').nullable(),
  minStock: numericField('Minimum stock').nullable(),
  maxStock: numericField('Maximum stock').nullable(),
  availableStock: numericField('Opening stock').nullable(),
  imageData: yup.string().nullable(),
});

const stepFields = {
  identity: ['name', 'brandId', 'categoryId', 'subCategoryId', 'sku', 'model', 'referenceCode', 'barcode', 'unitOfMeasure'],
  pricing: ['sellingPrice', 'purchasePrice', 'mrp', 'discountPercent', 'maxDiscountPercent', 'gstPercent', 'hsnCode', 'taxType'],
  inventory: ['minStock', 'maxStock', 'expiryDate', 'status', 'warrantyPeriod', 'availableStock'],
  details: ['description', 'tagsText', 'imageData'],
};

function SearchIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  );
}

function InfoIcon({ text }) {
  return (
    <span
      className="inline-grid h-[18px] w-[18px] place-items-center rounded-full border border-slate-300 bg-slate-50 text-[11px] text-slate-600 cursor-help"
      title={text}
      aria-label={text}
    >
      i
    </span>
  );
}

function Field({ label, tip, hint, children, fullSpan = false, error }) {
  const tooltip = [tip, hint].filter(Boolean).join('\n');
  return (
    <div className={`grid gap-1.5 ${fullSpan ? 'col-span-full' : ''}`}>
      <div className="inline-flex items-center gap-2 text-[13px] font-bold text-slate-900">
        <span>{label}</span>
        <InfoIcon text={tooltip} />
      </div>
      {children}
      {error ? <div className="text-xs leading-5 text-red-700">{error}</div> : null}
    </div>
  );
}

const money = (v) => Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const splitCsv = (v = '') => v.split(',').map((x) => x.trim()).filter(Boolean);
const joinCsv = (v = []) => (Array.isArray(v) ? v.join(', ') : '');
const apiOrigin = (process.env.REACT_APP_API_URL || 'http://localhost:4000/api').replace(/\/api\/?$/, '');
const resolveImageUrl = (url = '') => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/uploads/')) return `${apiOrigin}${url}`;
  return url;
};

export default function ProductsSection() {
  const [items, setItems] = useState([]);
  const [brands, setBrands] = useState([]);
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [mastersLoading, setMastersLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [editingId, setEditingId] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeStep, setActiveStep] = useState('identity');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState('');
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    trigger,
    formState: { errors },
  } = useForm({
    resolver: yupResolver(schema),
    defaultValues: blank,
  });
  const form = watch();
  const selectedCategoryId = form.categoryId;

  const loadMasters = async () => {
    setMastersLoading(true);
    try {
      const [b, c] = await Promise.all([
        brandsAPI.getBrands({ page: 1, limit: 100 }),
        categoriesAPI.getCategories({ page: 1, limit: 100 }),
      ]);
      setBrands(Array.isArray(b.data?.items) ? b.data.items : []);
      setCategories(Array.isArray(c.data?.items) ? c.data.items : []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load product masters');
    } finally {
      setMastersLoading(false);
    }
  };


  const loadItems = async ({ search = appliedQuery, nextPage = page, nextLimit = limit } = {}) => {
    setLoading(true);
    setError('');
    try {
      const res = await productsAPI.getProducts(nextPage, nextLimit, search);
      const data = res.data || {};
      setItems(Array.isArray(data.items) ? data.items : []);
      setPage(data.page || nextPage);
      setLimit(data.limit || nextLimit);
      setPagination({
        page: data.page || nextPage,
        limit: data.limit || nextLimit,
        total: data.total || 0,
        totalPages: Math.max(data.totalPages || 1, 1),
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMasters();
    loadItems({ search: '', nextPage: 1, nextLimit: 10 });
  }, []);

  useEffect(() => {
    let active = true;
    const sync = async () => {
      if (!selectedCategoryId) {
        setSubcategories([]);
        setValue('subCategoryId', '');
        return;
      }
      try {
        const res = await subcategoriesAPI.getSubcategories({ page: 1, limit: 200, categoryId: selectedCategoryId });
        const data = res.data || {};
        const items = Array.isArray(data.items) ? data.items : [];
        if (!active) return;
        setSubcategories(items);
        if (!items.some((item) => item._id === form.subCategoryId)) {
          setValue('subCategoryId', '');
        }
      } catch {
        if (active) setSubcategories([]);
      }
    };
    sync();
    return () => {
      active = false;
    };
  }, [selectedCategoryId]);

  const resetForm = () => {
    reset(blank);
    setEditingId('');
    setActiveStep('identity');
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
    }
    setImagePreviewUrl('');
    setImageFile(null);
  };

  const closeModal = () => {
    resetForm();
    setError('');
    setIsModalOpen(false);
  };

  const openAdd = () => {
    resetForm();
    setError('');
    setIsModalOpen(true);
  };

  const preventPrematureSubmit = (e) => {
    if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
      e.preventDefault();
    }
  };

  const onImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type?.startsWith('image/')) {
      setError('Please select a valid image file');
      return;
    }
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
    }
    const preview = URL.createObjectURL(file);
    setImagePreviewUrl(preview);
    setImageFile(file);
    setError('');
  };

  const openEdit = (item) => {
    setEditingId(item._id);
    reset({
      name: item.name || '',
      description: item.description || '',
      sku: item.sku || '',
      brandId: item.brandId?._id || '',
      categoryId: item.categoryId?._id || '',
      subCategoryId: item.subCategoryId?._id || item.subCategoryId || '',
      model: item.model || '',
      referenceCode: item.oemNumber || '',
      barcode: item.barcode || '',
      unitOfMeasure: item.unitOfMeasure || '',
      sellingPrice: item.sellingPrice?.amount ?? '',
      purchasePrice: item.purchasePrice?.amount ?? '',
      mrp: item.mrp ?? '',
      discountPercent: item.discountPercent ?? '',
      maxDiscountPercent: item.maxDiscountPercent ?? '',
      hsnCode: item.hsnCode || '',
      gstPercent: item.gstPercent ?? '',
      taxType: item.taxType || 'GST',
      status: item.status || 'active',
      warrantyPeriod: item.warrantyPeriod || '',
      minStock: item.minStock ?? '',
      maxStock: item.maxStock ?? '',
      availableStock: item.inventoryStatus?.available ?? '',
      expiryDate: item.expiryDate ? String(item.expiryDate).slice(0, 10) : '',
      tagsText: joinCsv(item.tags),
      imageData: Array.isArray(item.images) && item.images.length ? item.images[0] : '',
    });
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
    }
    setImagePreviewUrl('');
    setImageFile(null);
    setError('');
    setActiveStep('identity');
    setIsModalOpen(true);
  };

  const submit = async (formValues) => {
    setSaving(true);
    setError('');
    try {
      let imageUrl = formValues.imageData || '';
      if (imageFile) {
        const res = await productsAPI.uploadProductImage(imageFile);
        imageUrl = res.data?.absoluteUrl || res.data?.url || '';
        if (!imageUrl) {
          setError('Image upload failed');
          return;
        }
      }
      const payload = {
        name: formValues.name.trim(),
        description: formValues.description.trim(),
        sku: formValues.sku.trim(),
        brandId: formValues.brandId,
        categoryId: formValues.categoryId,
        subCategoryId: formValues.subCategoryId || undefined,
        model: formValues.model.trim(),
        oemNumber: formValues.referenceCode.trim(),
        barcode: formValues.barcode.trim(),
        unitOfMeasure: formValues.unitOfMeasure.trim(),
        sellingPrice: { amount: Number(formValues.sellingPrice || 0) },
        purchasePrice: { amount: Number(formValues.purchasePrice || 0) },
        mrp: Number(formValues.mrp || 0),
        discountPercent: Number(formValues.discountPercent || 0),
        maxDiscountPercent: Number(formValues.maxDiscountPercent || 0),
        hsnCode: formValues.hsnCode.trim(),
        gstPercent: Number(formValues.gstPercent || 0),
        taxType: formValues.taxType,
        status: formValues.status,
        warrantyPeriod: formValues.warrantyPeriod.trim(),
        minStock: Number(formValues.minStock || 0),
        maxStock: Number(formValues.maxStock || 0),
        expiryDate: formValues.expiryDate || undefined,
        tags: splitCsv(formValues.tagsText),
        images: imageUrl ? [imageUrl] : [],
      };
      if (!editingId) payload.inventoryStatus = { available: Number(formValues.availableStock || 0) };
      if (editingId) {
        await productsAPI.updateProduct(editingId, payload);
      } else {
        await productsAPI.createProduct(payload);
      }
      const nextPage = editingId ? page : 1;
      setPage(nextPage);
      await loadItems({ search: appliedQuery, nextPage, nextLimit: limit });
      closeModal();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save product');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    setSaving(true);
    setError('');
    try {
      await productsAPI.deleteProduct(id);
      const nextTotal = Math.max(pagination.total - 1, 0);
      const nextTotalPages = Math.max(Math.ceil(nextTotal / limit), 1);
      const nextPage = Math.min(page, nextTotalPages);
      setPage(nextPage);
      await loadItems({ search: appliedQuery, nextPage, nextLimit: limit });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete product');
    } finally {
      setSaving(false);
    }
  };

  const totalPages = Math.max(pagination.totalPages || 1, 1);
  const fromRecord = pagination.total === 0 ? 0 : (page - 1) * limit + 1;
  const toRecord = pagination.total === 0 ? 0 : Math.min(page * limit, pagination.total);
  const stepIndex = steps.findIndex(([key]) => key === activeStep);

  const firstErrorStep = (fieldErrors) =>
    Object.entries(stepFields).find(([, names]) => names.some((name) => fieldErrors[name]))?.[0] || 'identity';

  const onInvalidSubmit = (fieldErrors) => {
    setError('Please fix the highlighted fields before saving');
    setActiveStep(firstErrorStep(fieldErrors));
  };

  const goNext = async () => {
    const valid = await trigger(stepFields[activeStep]);
    if (!valid) {
      setError('Please fix the highlighted fields before continuing');
      return;
    }
    setError('');
    if (stepIndex >= steps.length - 1) return;
    setActiveStep(steps[stepIndex + 1][0]);
  };

  const stepDotClass = (active, complete) =>
    [
      'grid h-[34px] w-[34px] place-items-center rounded-full text-sm font-extrabold transition',
      active ? 'bg-sky-500 text-white shadow-[0_8px_18px_rgba(14,165,233,.22)]' : '',
      !active && complete ? 'bg-blue-100 text-blue-700' : '',
      !active && !complete ? 'bg-slate-200 text-slate-600' : '',
    ].join(' ');

  const stepUi = () => {
    if (activeStep === 'identity') {
      return (
        <>
          <div className="grid gap-1">
            <div className="text-lg font-extrabold text-slate-900">Identity & Catalog</div>
            <div className="text-sm leading-6 text-slate-500">Core details people use to recognize and search the product.</div>
          </div>
          <div className="grid gap-3.5 md:grid-cols-2 xl:grid-cols-3">
            <Field label="Product Name" tip="Main display name used across billing, lists, and search." hint="Choose a clear, business-neutral name." error={errors.name?.message}>
              <input className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900" {...register('name')} placeholder="Product name *" />
            </Field>
            <Field label="SKU" tip="Internal stock code for lookup and reporting." hint="Useful if your business tracks stock by code." error={errors.sku?.message}>
              <input className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900" {...register('sku')} placeholder="SKU" />
            </Field>
            <Field label="Brand" tip="Brand groups products for filters and reporting." hint="Optional in some businesses, helpful in most." error={errors.brandId?.message}>
              <select className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900" {...register('brandId')} disabled={mastersLoading}><option value="">Select brand *</option>{brands.map((x) => <option key={x._id} value={x._id}>{x.name}</option>)}</select>
            </Field>
            <Field label="Category" tip="Primary grouping used in catalog organization." hint="Pick the main category for this item." error={errors.categoryId?.message}>
              <select className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900" {...register('categoryId')} disabled={mastersLoading}><option value="">Select category *</option>{categories.map((x) => <option key={x._id} value={x._id}>{x.name}</option>)}</select>
            </Field>
            <Field label="Subcategory" tip="Secondary grouping inside a category." hint="Select a subcategory after choosing a category." error={errors.subCategoryId?.message}>
              <select className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900" {...register('subCategoryId')} disabled={!selectedCategoryId}>
                <option value="">{selectedCategoryId ? 'Select subcategory' : 'Select category first'}</option>
                {subcategories.map((item) => (
                  <option key={item._id} value={item._id}>{item.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Model / Variant" tip="Secondary identifier such as model or size." hint="Works across retail, service, and distribution businesses." error={errors.model?.message}>
              <input className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900" {...register('model')} placeholder="Model / variant" />
            </Field>
            <Field label="Reference Code" tip="Neutral internal or supplier reference number." hint="Use this instead of industry-specific part labels." error={errors.referenceCode?.message}>
              <input className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900" {...register('referenceCode')} placeholder="Reference code" />
            </Field>
            <Field label="Barcode" tip="Scannable identifier used at billing or stock entry." hint="Leave blank if your business does not use barcodes." error={errors.barcode?.message}>
              <input className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900" {...register('barcode')} placeholder="Barcode" />
            </Field>
            <Field label="Unit" tip="Measurement or selling unit for this product." hint="Examples: pcs, kg, litre, box." error={errors.unitOfMeasure?.message}>
              <input className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900" {...register('unitOfMeasure')} placeholder="Unit of measurement" />
            </Field>
          </div>
        </>
      );
    }

    if (activeStep === 'pricing') {
      return (
        <>
          <div className="grid gap-1">
            <div className="text-lg font-extrabold text-slate-900">Pricing & Tax</div>
            <div className="text-sm leading-6 text-slate-500">Commercial values used in billing, margin tracking, and tax reporting.</div>
          </div>
          <div className="grid gap-3.5 md:grid-cols-2 xl:grid-cols-3">
            <Field label="Selling Price" tip="Standard sale price used during billing." hint="Usually the default POS selling amount." error={errors.sellingPrice?.message}><input className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900" {...register('sellingPrice')} placeholder="Selling price *" type="number" min="0" step="0.01" /></Field>
            <Field label="Purchase Price" tip="Buying cost used for margin and purchase tracking." hint="Use your current or standard cost." error={errors.purchasePrice?.message}><input className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900" {...register('purchasePrice')} placeholder="Purchase price *" type="number" min="0" step="0.01" /></Field>
            <Field label="MRP" tip="Maximum retail price where applicable." hint="Optional if your business does not use MRP." error={errors.mrp?.message}><input className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900" {...register('mrp')} placeholder="MRP" type="number" min="0" step="0.01" /></Field>
            <Field label="Discount %" tip="Default discount allowed on the item." hint="Useful for routine promotions or staff billing." error={errors.discountPercent?.message}><input className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900" {...register('discountPercent')} placeholder="Discount %" type="number" min="0" step="0.01" /></Field>
            <Field label="Max Discount %" tip="Upper discount limit allowed for the item." hint="Good for pricing control and approval rules." error={errors.maxDiscountPercent?.message}><input className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900" {...register('maxDiscountPercent')} placeholder="Max discount %" type="number" min="0" step="0.01" /></Field>
            <Field label="GST %" tip="Tax rate applied to the product." hint="Examples: 0, 5, 12, 18, 28." error={errors.gstPercent?.message}><input className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900" {...register('gstPercent')} placeholder="GST %" type="number" min="0" step="0.01" /></Field>
            <Field label="HSN / SAC Code" tip="Tax classification code for invoice compliance." hint="Useful for tax-sensitive businesses." error={errors.hsnCode?.message}><input className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900" {...register('hsnCode')} placeholder="HSN / SAC code" /></Field>
            <Field label="Tax Type" tip="How the product tax should be categorized." hint="Use the one that matches your billing setup." error={errors.taxType?.message}><select className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900" {...register('taxType')}><option value="GST">GST</option><option value="IGST">IGST</option><option value="CGST+SGST">CGST + SGST</option><option value="Exempt">Exempt</option></select></Field>
          </div>
        </>
      );
    }

    if (activeStep === 'inventory') {
      return (
        <>
          <div className="grid gap-1">
            <div className="text-lg font-extrabold text-slate-900">Inventory & Visibility</div>
            <div className="text-sm leading-6 text-slate-500">Define stock behavior, alert levels, and whether the product is active.</div>
          </div>
          <div className="grid gap-3.5 md:grid-cols-2 xl:grid-cols-3">
            <Field label="Minimum Stock" tip="Threshold used for low-stock alerts." hint="Set to zero if alerts are not needed." error={errors.minStock?.message}><input className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900" {...register('minStock')} placeholder="Minimum stock" type="number" min="0" /></Field>
            <Field label="Maximum Stock" tip="Optional upper planning limit for this item." hint="Helpful for storage-sensitive businesses." error={errors.maxStock?.message}><input className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900" {...register('maxStock')} placeholder="Maximum stock" type="number" min="0" /></Field>
            <Field label="Expiry Date" tip="Useful for perishable or regulated items." hint="Optional; leave blank if not relevant." error={errors.expiryDate?.message}><input className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900" {...register('expiryDate')} type="date" /></Field>
            <Field label="Status" tip="Controls whether the product is available in active workflows." hint="Inactive items remain in history but can be hidden." error={errors.status?.message}><select className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900" {...register('status')}><option value="active">Active</option><option value="inactive">Inactive</option></select></Field>
            <Field label="Warranty Period" tip="Support or service duration offered with the item." hint="Examples: no warranty, 6 months, 1 year." error={errors.warrantyPeriod?.message}><input className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900" {...register('warrantyPeriod')} placeholder="Warranty period" /></Field>
            <Field label="Opening Stock" tip="Starting available quantity when creating a new item." hint={editingId ? 'Existing products should be adjusted through stock workflows.' : 'Only used when creating a new record.'} error={errors.availableStock?.message}><input className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900 disabled:bg-slate-100 disabled:text-slate-400" {...register('availableStock')} placeholder={editingId ? 'Opening stock managed elsewhere' : 'Initial stock'} type="number" min="0" disabled={!!editingId} /></Field>
          </div>
        </>
      );
    }

    return (
      <>
        <div className="grid gap-1">
          <div className="text-lg font-extrabold text-slate-900">Details & Searchability</div>
          <div className="text-sm leading-6 text-slate-500">Add context that helps teams understand and find the product faster.</div>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="grid gap-3.5">
            <Field label="Description / Notes" tip="Extra context to help staff understand the product." hint="Use this for internal clarity or customer-facing notes." error={errors.description?.message}>
              <textarea className="min-h-24 w-full resize-y rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900" {...register('description')} placeholder="Product description / notes" />
            </Field>
            <Field label="Tags" tip="Comma-separated keywords used for quick search and filtering." hint="Examples: premium, reusable, fast-moving." error={errors.tagsText?.message}>
              <textarea className="min-h-24 w-full resize-y rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900" {...register('tagsText')} placeholder="Tags / keywords, comma separated" />
            </Field>
          </div>
          <Field label="Product Image" tip="Upload one image to represent the product." hint="Image uploads on save; only a single image is supported." error={errors.imageData?.message}>
            <input type="hidden" {...register('imageData')} />
            <div className="grid min-h-[220px] gap-3 rounded-[14px] border border-dashed border-slate-300 bg-slate-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <input type="file" accept="image/*" className="max-w-full text-[13px] text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-blue-700" onChange={onImageUpload} disabled={saving} />
                {(imagePreviewUrl || form.imageData) ? <button type="button" className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-900" onClick={() => { if (imagePreviewUrl) { URL.revokeObjectURL(imagePreviewUrl); } setImagePreviewUrl(''); setImageFile(null); setValue('imageData', '', { shouldValidate: true, shouldDirty: true }); }}>Remove Image</button> : null}
              </div>
              <div className="flex flex-1 items-center justify-center">
                {(imagePreviewUrl || form.imageData) ? (
                  <img src={imagePreviewUrl || resolveImageUrl(form.imageData)} alt="Product preview" className="h-[160px] w-[160px] rounded-[14px] border border-slate-300 bg-white object-cover" />
                ) : (
                  <div className="text-sm leading-6 text-slate-500">No image selected yet.</div>
                )}
              </div>
            </div>
          </Field>
        </div>
      </>
    );
  };

  return (
    <div className="overflow-hidden rounded-[18px] border border-slate-200 bg-white shadow-[0_10px_24px_rgba(15,23,42,.06)]">
      <div className="grid gap-4 p-5">
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(240px,340px)]">
          <div className="grid gap-1.5 pb-1">
            <div className="text-2xl font-extrabold tracking-[-0.02em] text-slate-900">Inventory / Products</div>
            <div className="max-w-[860px] text-[13px] leading-6 text-slate-500">Manage the product catalog, pricing, tax details, and inventory metadata.</div>
          </div>
          <form className="flex justify-end" onSubmit={(e) => { e.preventDefault(); const nextQuery = query.trim(); setAppliedQuery(nextQuery); setPage(1); loadItems({ search: nextQuery, nextPage: 1, nextLimit: limit }); }}>
            <div className="relative w-full max-w-[340px]">
              <input className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 pr-11 text-sm text-slate-900" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name, SKU, brand, category, barcode" />
              <button type="submit" className="absolute right-2 top-1/2 grid h-[30px] w-[30px] -translate-y-1/2 place-items-center rounded-lg bg-transparent text-slate-500" disabled={loading} aria-label="Search products">
                <SearchIcon />
              </button>
            </div>
          </form>
        </div>

        <div className="grid items-center gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
          <div className="text-sm leading-6 text-slate-500">{loading ? 'Loading...' : `${pagination.total} record(s)`}</div>
          <button type="button" className="rounded-xl border border-blue-600 bg-blue-600 px-4 py-2.5 text-sm font-bold text-white" onClick={openAdd}>
            Add Product
          </button>
        </div>

        {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700">{error}</div> : null}

        <div className="overflow-hidden rounded-2xl border border-slate-200">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  {['Image', 'Name', 'SKU', 'Brand', 'Category', 'Stock', 'Selling', 'MRP', 'Tax', 'Status', 'Actions'].map((heading) => (
                    <th key={heading} className="border-b border-slate-200 bg-slate-50 px-3.5 py-3 text-left text-xs font-bold uppercase tracking-[0.05em] text-slate-500">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan="11" className="px-7 py-8 text-center text-sm text-slate-500">
                      No products found yet.
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr key={item._id}>
                      <td className="border-b border-slate-100 px-3.5 py-3.5 align-top text-sm text-slate-900">
                        {(() => {
                          const imageValue = Array.isArray(item.images) ? item.images[0] : item.images;
                          const resolved = resolveImageUrl(imageValue || '');
                          return resolved ? (
                            <img
                              src={resolved}
                              alt={item.name || 'Product'}
                              className="h-10 w-10 rounded-lg border border-slate-200 object-cover"
                            />
                          ) : (
                            <div className="h-10 w-10 rounded-lg border border-dashed border-slate-200 bg-slate-50" />
                          );
                        })()}
                      </td>
                      <td className="border-b border-slate-100 px-3.5 py-3.5 align-top text-sm text-slate-900">
                        <div className="grid gap-1">
                          <div className="font-bold">{item.name || '--'}</div>
                          <div className="text-sm leading-6 text-slate-500">{item.model || '--'}{item.barcode ? ` | ${item.barcode}` : ''}</div>
                          <div className="text-sm leading-6 text-slate-500">{item.description || '--'}</div>
                        </div>
                      </td>
                      <td className="border-b border-slate-100 px-3.5 py-3.5 align-top text-sm text-slate-900">{item.sku || '--'}</td>
                      <td className="border-b border-slate-100 px-3.5 py-3.5 align-top text-sm text-slate-900">{item.brand || '--'}</td>
                      <td className="border-b border-slate-100 px-3.5 py-3.5 align-top text-sm text-slate-900">{item.category || '--'}</td>
                      <td className="border-b border-slate-100 px-3.5 py-3.5 align-top text-sm text-slate-900">{item.inventoryStatus?.available ?? 0}</td>
                      <td className="border-b border-slate-100 px-3.5 py-3.5 align-top text-sm text-slate-900">INR {money(item.sellingPrice?.amount)}</td>
                      <td className="border-b border-slate-100 px-3.5 py-3.5 align-top text-sm text-slate-900">INR {money(item.mrp)}</td>
                      <td className="border-b border-slate-100 px-3.5 py-3.5 align-top text-sm text-slate-900"><div className="grid gap-1"><div>{item.taxType || 'GST'}</div><div className="text-sm leading-6 text-slate-500">{item.gstPercent || 0}%</div></div></td>
                      <td className="border-b border-slate-100 px-3.5 py-3.5 align-top text-sm text-slate-900"><span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${((item.status || 'active') === 'active') ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-50 text-slate-600'}`}>{(item.status || 'active') === 'active' ? 'Active' : 'Inactive'}</span></td>
                      <td className="border-b border-slate-100 px-3.5 py-3.5 align-top text-sm text-slate-900"><div className="flex flex-wrap gap-2"><button type="button" className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-900" onClick={() => openEdit(item)}>Edit</button><button type="button" className="rounded-xl border border-red-500 bg-white px-3 py-2 text-sm font-bold text-red-700" onClick={() => remove(item._id)}>Delete</button></div></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-slate-500">{loading ? 'Loading page...' : `Showing ${fromRecord}-${toRecord} of ${pagination.total}`}</div>
          <div className="flex flex-wrap items-center gap-2.5">
            <label className="text-sm text-slate-500">Rows per page <select value={limit} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900" onChange={(e) => { const nextLimit = parseInt(e.target.value, 10); setLimit(nextLimit); setPage(1); loadItems({ search: appliedQuery, nextPage: 1, nextLimit }); }}>{[10, 20, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}</select></label>
            <div className="text-sm text-slate-500">Page {page} of {totalPages}</div>
            <div className="flex items-center gap-2">
              <button type="button" className={`rounded-xl border px-3 py-2 text-sm font-bold ${page <= 1 || loading ? 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400' : 'border-slate-300 bg-white text-slate-900'}`} disabled={page <= 1 || loading} onClick={() => { const nextPage = page - 1; setPage(nextPage); loadItems({ search: appliedQuery, nextPage, nextLimit: limit }); }}>Previous</button>
              <button type="button" className={`rounded-xl border px-3 py-2 text-sm font-bold ${page >= totalPages || loading ? 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400' : 'border-slate-300 bg-white text-slate-900'}`} disabled={page >= totalPages || loading} onClick={() => { const nextPage = page + 1; setPage(nextPage); loadItems({ search: appliedQuery, nextPage, nextLimit: limit }); }}>Next</button>
            </div>
          </div>
        </div>
      </div>

      {isModalOpen ? (
        <div className="fixed inset-0 z-[1200] grid place-items-center bg-slate-900/40 p-5" onClick={closeModal}>
          <div className="w-full max-w-[940px] overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-[0_24px_60px_rgba(15,23,42,.2)]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 pb-3.5 pt-[18px]">
              <div className="grid gap-1"><div className="text-xl font-extrabold tracking-[-0.02em] text-slate-900">{editingId ? 'Edit Product' : 'Add Product'}</div><div className="text-sm leading-6 text-slate-500">Move step by step so the form stays focused and easier to complete.</div></div>
              <button type="button" className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-900" onClick={closeModal}>Close</button>
            </div>
            <div className="grid gap-[18px] p-5">
              {mastersLoading ? <div className="text-sm leading-6 text-slate-500">Loading brands and categories...</div> : null}
              <div className="grid grid-cols-4 items-start gap-2.5">
                {steps.map(([key, label, hint], index) => <button key={key} type="button" className="grid justify-items-center gap-2" onClick={() => setActiveStep(key)}><div className={stepDotClass(activeStep === key, index < stepIndex)}>{index + 1}</div><div className={`text-center text-xs font-bold ${activeStep === key ? 'text-slate-900' : 'text-slate-600'}`}>{label}</div><div className="text-center text-[11px] leading-4 text-slate-400">{hint}</div></button>)}
              </div>
              <form className="grid gap-4" onSubmit={handleSubmit(submit, onInvalidSubmit)} onKeyDown={preventPrematureSubmit}>
                <div className="grid min-h-[320px] gap-4 rounded-[18px] border border-slate-200 bg-gradient-to-b from-white to-slate-50 p-[18px]">{stepUi()}</div>
                {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700">{error}</div> : null}
                <div className="flex flex-wrap items-center justify-between gap-2.5">
                  <div className="flex flex-wrap gap-2.5"><button type="button" className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-900" onClick={closeModal}>Cancel</button></div>
                  <div className="flex flex-wrap gap-2.5">
                    <button type="button" className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-900 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400" onClick={() => setActiveStep(steps[Math.max(stepIndex - 1, 0)][0])} disabled={stepIndex === 0}>Back</button>
                    {stepIndex < steps.length - 1 ? <button type="button" className="rounded-xl border border-blue-600 bg-blue-600 px-4 py-2.5 text-sm font-bold text-white" onClick={(e) => { e.preventDefault(); e.stopPropagation(); goNext(); }}>Next</button> : <button type="submit" className="rounded-xl border border-blue-600 bg-blue-600 px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:border-blue-300 disabled:bg-blue-300" disabled={saving || mastersLoading}>{editingId ? 'Save Changes' : 'Add Product'}</button>}
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
