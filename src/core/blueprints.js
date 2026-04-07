/**
 * mBT Industry Blueprints
 * @description Budget template library for film production
 */

(function () {
    'use strict';

    window.mBT = window.mBT || {};
    window.mBT.blueprints = window.mBT.blueprints || {};

    // Industry standard budget categories
    var CATEGORY_DEFINITIONS = {
        labor: {
            name: 'Labor',
            subcategories: ['director', 'cinematographer', 'producer', 'crew', 'above_the_line', 'mixer', 'boom', 'utility'],
            defaultRate: 1000,
            description: 'Personnel costs'
        },
        equipment: {
            name: 'Equipment',
            subcategories: ['camera', 'lighting', 'sound', 'arsenal', 'vfx'],
            defaultRate: 500,
            description: 'Gear and equipment rental'
        },
        location: {
            name: 'Location',
            subcategories: ['studio', 'outside', 'permits', 'insurance'],
            defaultRate: 300,
            description: 'Venue and location costs'
        },
        transport: {
            name: 'Transport',
            subcategories: ['vehicles', 'fuel', 'parking', 'crew'],
            defaultRate: 200,
            description: 'Vehicle and travel costs'
        },
        insurance: {
            name: 'Insurance',
            subcategories: ['liability', 'equipment', 'workers_comp'],
            defaultRate: 100,
            description: 'Insurance premiums'
        },
        misc: {
            name: 'Miscellaneous',
            subcategories: [],
            defaultRate: 100,
            description: 'Other costs'
        }
    };

    /* --- Synonym Registry: maps internal subcategory keys to OpenGate description strings --- */
    /* Used by generateBudgetFromTemplate(withRates=true) to query mBTOG.rates */
    var SYNONYM_REGISTRY = {
        /* Labor */
        director:        'Director',
        cinematographer: 'Director of Photography (DP)',
        producer:        'Producer',
        crew:            'Camera Operator',
        above_the_line:  'Line Producer',
        mixer:           'Sound Mixer',
        boom:            'Boom Operator',
        utility:         'Sound Utility',
        /* Equipment */
        camera:          'Camera Operator',
        lighting:        'Gaffer',
        sound:           'Sound Mixer',
        arsenal:         'Key Grip',
        vfx:             'VFX Artist',
        /* Location */
        studio:          'Location Manager',
        outside:         'Location Scout',
        permits:         'Legal - Rights & Clearances',
        /* Post */
        editor:          'Editor',
        colorist:        'Colorist'
    };

    // Budget templates for different production types
    var TEMPLATES = {
        commercial: {
            name: 'Commercial Production',
            duration: 3, // days
            scale: 1.0,
            categories: {
                labor: { allocation: 0.40, description: '40% of budget' },
                equipment: { allocation: 0.25, description: '25% of budget' },
                location: { allocation: 0.15, description: '15% of budget' },
                transport: { allocation: 0.10, description: '10% of budget' },
                insurance: { allocation: 0.05, description: '5% of budget' },
                misc: { allocation: 0.05, description: '5% of budget' }
            },
            typicalHeadcount: 25,
            typicalDuration: '3-5 days'
        },
        documentary: {
            name: 'Documentary',
            duration: 7, // days
            scale: 1.0,
            categories: {
                labor: { allocation: 0.35, description: '35% of budget' },
                equipment: { allocation: 0.20, description: '20% of budget' },
                location: { allocation: 0.25, description: '25% of budget' },
                transport: { allocation: 0.12, description: '12% of budget' },
                insurance: { allocation: 0.05, description: '5% of budget' },
                misc: { allocation: 0.03, description: '3% of budget' }
            },
            typicalHeadcount: 15,
            typicalDuration: '5-10 days'
        },
        live_stream: {
            name: 'Live Stream Event',
            duration: 1, // hours
            scale: 1.0,
            categories: {
                labor: { allocation: 0.45, description: '45% of budget' },
                equipment: { allocation: 0.25, description: '25% of budget' },
                location: { allocation: 0.15, description: '15% of budget' },
                transport: { allocation: 0.10, description: '10% of budget' },
                insurance: { allocation: 0.03, description: '3% of budget' },
                misc: { allocation: 0.02, description: '2% of budget' }
            },
            typicalHeadcount: 40,
            typicalDuration: '1-4 hours'
        },
        music_video: {
            name: 'Music Video',
            duration: 2, // days
            scale: 1.0,
            categories: {
                labor: { allocation: 0.38, description: '38% of budget' },
                equipment: { allocation: 0.28, description: '28% of budget' },
                location: { allocation: 0.18, description: '18% of budget' },
                transport: { allocation: 0.10, description: '10% of budget' },
                insurance: { allocation: 0.04, description: '4% of budget' },
                misc: { allocation: 0.02, description: '2% of budget' }
            },
            typicalHeadcount: 20,
            typicalDuration: '2-4 days'
        }
    };

    /**
     * Generate a new budget from template
     * @param {string} templateName - Template key
     * @param {number} totalBudget - Total budget amount
     * @param {boolean} [withRates] - When true, injects live rates from mBTOG per subcategory
     * @returns {Object} Budget structure with optional line items
     */
    function generateBudgetFromTemplate(templateName, totalBudget, withRates) {
        var template = TEMPLATES[templateName] || TEMPLATES.commercial;
        var categories = Object.entries(template.categories);

        /* Rate source: pull from OpenGate when withRates is true and mBTOG is available */
        var rateDb = [];
        var regionMult = 1;
        if (withRates && typeof window.mBTOG !== 'undefined') {
            rateDb = window.mBTOG.rates || [];
            regionMult = window.mBTOG.settings.regionMultiplier || 1;
        }

        var budget = {
            project_title: 'New Project',
            total_budget: totalBudget,
            duration: template.duration,
            headcount: template.typicalHeadcount,
            categories: {}
        };

        categories.forEach(function(entry) {
            var catKey = entry[0];
            var catDef = CATEGORY_DEFINITIONS[catKey] || {};
            var amount = totalBudget * entry[1].allocation;
            var subcats = catDef.subcategories || [];
            var defaultRate = catDef.defaultRate || 0;

            /* Option A Population: generate actual line items when withRates is enabled */
            var items = [];
            if (withRates && subcats.length > 0) {
                subcats.forEach(function (subcat) {
                    var longName = SYNONYM_REGISTRY[subcat] || subcat.replace(/_/g, ' ');
                    var match = null;
                    var q = longName.toLowerCase();
                    for (var ri = 0; ri < rateDb.length; ri++) {
                        if ((rateDb[ri].description || '').toLowerCase() === q) {
                            match = rateDb[ri];
                            break;
                        }
                    }
                    var rate = match ? Math.round(match.rate * regionMult) : defaultRate;
                    items.push({
                        name: longName,
                        unit: match ? match.unit : 'Day',
                        unit_price: rate,
                        quantity: 1,
                        amount: rate
                    });
                });
            }

            budget.categories[catKey] = {
                name: entry[1].name || catDef.name,
                description: entry[1].description,
                amount: amount,
                items: items
            };
        });

        return budget;
    }

    /**
     * Hydrate with default categories if none exist
     * @param {Object} budget - Budget to hydrate
     * @returns {Object} Hydrated budget
     */
    function hydrateBudget(budget) {
        if (!budget) return {};

        var existingCategories = {};
        Object.keys(budget.categories || {}).forEach(function(k) { existingCategories[k] = true; });

        Object.entries(CATEGORY_DEFINITIONS).forEach(function(entry) {
            if (!existingCategories[entry[0]]) {
                budget.categories[entry[0]] = {
                    name: entry[1].name,
                    description: entry[1].description,
                    amount: 0,
                    items: []
                };
            }
        });

        return budget;
    }

    /**
     * Generate industry-standard default budget
     * @param {number} budgetAmount - Total budget amount
     * @returns {Object} Complete budget structure
     */
    function generateDefaultBudget(budgetAmount) {
        var templateBudget = generateBudgetFromTemplate('commercial', budgetAmount);
        var hydrated = hydrateBudget(templateBudget);

        Object.values(hydrated.categories).forEach(function(cat) {
            cat.subcategories = cat.subcategories || [];
        });

        return hydrated;
    }

    /**
     * Validate budget structure
     * @param {Object} budget - Budget to validate
     * @returns {Object} Validation result
     */
    function validateBudget(budget) {
        if (!budget) {
            return {
                valid: false,
                errors: ['No budget data provided']
            };
        }

        var errors = [];

        if (!budget.project_title) {
            errors.push('Project title is required');
        }

        if (!budget.total_budget || budget.total_budget <= 0) {
            errors.push('Total budget must be a positive number');
        }

        var categoryTotal = Object.entries(budget.categories || {})
            .reduce(function(sum, entry) { return sum + (entry[1].amount || 0); }, 0);

        var variance = Math.abs(budget.total_budget - categoryTotal);
        if (variance > 10) {
            errors.push('Category sum ($' + categoryTotal.toFixed(2) + ') differs from total budget ($' + budget.total_budget.toFixed(2) + ') by $' + variance.toFixed(2));
        }

        return {
            valid: errors.length === 0,
            errors: errors,
            budget: budget
        };
    }

    /**
     * Apply template scaling to existing budget
     * @param {Object} budget - Existing budget
     * @param {string} templateName - Template to apply
     * @param {number} factor - Scaling factor (e.g., 1.0, 0.5)
     * @returns {Object} Scaled budget
     */
    function applyTemplateScaling(budget, templateName, factor) {
        factor = factor || 1.0;
        if (!budget || !TEMPLATES[templateName]) return budget;

        var template = TEMPLATES[templateName];
        var scaled = Object.assign({}, budget);

        Object.entries(template.categories).forEach(function(entry) {
            var scaledAmount = (budget.total_budget || 0) * entry[1].allocation * factor;
            var existingItems = (budget.categories[entry[0]] && budget.categories[entry[0]].items) ? budget.categories[entry[0]].items : [];
            scaled.categories[entry[0]] = {
                name: entry[1].name,
                description: entry[1].description,
                amount: scaledAmount,
                items: existingItems
            };
        });

        return scaled;
    }

    /**
     * Estimate headcount based on budget and type
     * @param {Object} budget - Budget
     * @param {string} productionType - Commercial, Documentary, etc.
     * @returns {number} Estimated headcount
     */
    function estimateHeadcount(budget, productionType) {
        productionType = productionType || 'commercial';
        var template = TEMPLATES[productionType];
        var duration = (template && template.typicalDuration) ? template.typicalDuration : 1;
        var multiplier = budget.total_budget / duration || 1;
        var headcount = (template && template.typicalHeadcount) ? template.typicalHeadcount : 15;
        return Math.round(headcount * (multiplier / 1.5) || 15);
    }

    /**
     * Generate sample line items for categories
     * @param {Object} budget - Budget
     * @returns {Object} Budget with sample line items
     */
    function addSampleLineItems(budget) {
        if (!budget) return budget;

        var categories = budget.categories || {};
        Object.keys(categories).forEach(function(key) {
            var cat = categories[key];
            var subcategories = cat.subcategories || [];
            
            if (subcategories.length === 0) return;

            cat.items = subcategories.slice(0, 3).map(function(subcat) {
                return {
                    name: key + ' - ' + subcat.replace('_', ' '),
                    unit_price: 100,
                    quantity: 1,
                    amount: 100
                };
            });
        });

        return budget;
    }

    // === Public API ===
    window.mBT.blueprints.generateDefaultBudget = generateDefaultBudget;
    window.mBT.blueprints.generateBudgetFromTemplate = generateBudgetFromTemplate;
    window.mBT.blueprints.hydrateBudget = hydrateBudget;
    window.mBT.blueprints.validateBudget = validateBudget;
    window.mBT.blueprints.applyTemplateScaling = applyTemplateScaling;
    window.mBT.blueprints.estimateHeadcount = estimateHeadcount;
    window.mBT.blueprints.addSampleLineItems = addSampleLineItems;
    window.mBT.blueprints.TEMPLATES = TEMPLATES;
    window.mBT.blueprints.CATEGORY_DEFINITIONS = CATEGORY_DEFINITIONS;
    window.mBT.blueprints.SYNONYM_REGISTRY = SYNONYM_REGISTRY;

})();