/**
 * mBT Industry Blueprints
 * @description Budget template library for film production
 */

(function () {
    'use strict';

    window.mBT = window.mBT || {};
    window.mBT.blueprints = window.mBT.blueprints || {};

    // Industry standard budget categories
    const CATEGORY_DEFINITIONS = {
        labor: {
            name: 'Labor',
            subcategories: ['director', 'cinematographer', 'producer', 'crew', 'above_the_line'],
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

    // Budget templates for different production types
    const TEMPLATES = {
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
     * @returns {Object} Budget structure
     */
    function generateBudgetFromTemplate(templateName, totalBudget) {
        const template = TEMPLATES[templateName] || TEMPLATES.commercial;
        const categories = Object.entries(template.categories);

        const budget = {
            project_title: 'New Project',
            total_budget: totalBudget,
            duration: template.duration,
            headcount: template.typicalHeadcount,
            categories: {}
        };

        categories.forEach(([categoryKey, config]) => {
            const amount = totalBudget * config.allocation;
            budget.categories[categoryKey] = {
                name: config.name,
                description: config.description,
                amount: amount,
                items: []
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

        // Get existing categories
        const existingCategories = new Set(Object.keys(budget.categories || {}));

        // Add missing categories from definitions
        Object.entries(CATEGORY_DEFINITIONS).forEach(([key, definition]) => {
            if (!existingCategories.has(key)) {
                budget.categories[key] = {
                    name: definition.name,
                    description: definition.description,
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
        // Start with commercial template distribution
        const templateBudget = generateBudgetFromTemplate('commercial', budgetAmount);
        
        // Hydrate with all standard categories
        const hydrated = hydrateBudget(templateBudget);

        // Ensure all categories have proper structure
        Object.values(hydrated.categories).forEach(cat => {
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

        const errors = [];

        // Check for required fields
        if (!budget.project_title) {
            errors.push('Project title is required');
        }

        if (!budget.total_budget || budget.total_budget <= 0) {
            errors.push('Total budget must be a positive number');
        }

        // Validate categories sum to total budget
        const categoryTotal = Object.entries(budget.categories || {})
            .reduce((sum, [, cat]) => sum + (cat.amount || 0), 0);

        const variance = Math.abs(budget.total_budget - categoryTotal);
        if (variance > 10) { // Allow $10 variance due to rounding
            errors.push(`Category sum ($${categoryTotal.toFixed(2)}) differs from total budget ($${budget.total_budget.toFixed(2)}) by $${variance.toFixed(2)}`);
        }

        return {
            valid: errors.length === 0,
            errors,
            budget
        };
    }

    /**
     * Apply template scaling to existing budget
     * @param {Object} budget - Existing budget
     * @param {string} templateName - Template to apply
     * @param {number} factor - Scaling factor (e.g., 1.0, 0.5)
     * @returns {Object} Scaled budget
     */
    function applyTemplateScaling(budget, templateName, factor = 1.0) {
        if (!budget || !TEMPLATES[templateName]) return budget;

        const template = TEMPLATES[templateName];
        const scaled = { ...budget };

        Object.entries(template.categories).forEach(([key, config]) => {
            const scaledAmount = (budget.total_budget || 0) * config.allocation * factor;
            scaled.categories[key] = {
                name: config.name,
                description: config.description,
                amount: scaledAmount,
                items: budget.categories[key]?.items || []
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
    function estimateHeadcount(budget, productionType = 'commercial') {
        const template = TEMPLATES[productionType];
        const multiplier = budget.total_budget / (template?.typicalDuration || 1) || 1;
        return Math.round(template?.typicalHeadcount * (multiplier / 1.5) || 15);
    }

    /**
     * Generate sample line items for categories
     * @param {Object} budget - Budget
     * @returns {Object} Budget with sample line items
     */
    function addSampleLineItems(budget) {
        if (!budget) return budget;

        const categories = budget.categories || {};
        Object.keys(categories).forEach(key => {
            const cat = categories[key];
            const subcategories = cat.subcategories || [];
            
            if (subcategories.length === 0) return;

            // Generate sample items for this category
            cat.items = subcategories.slice(0, 3).map(subcat => ({
                name: `${key} - ${subcat.replace('_', ' ')}`,
                unit_price: 100,
                quantity: 1,
                amount: 100
            }));
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

})();