/**
 * mBT Storage Test Suite
 * @description Unit tests for IndexedDB storage operations
 * Run via: open mBT/tests/test-runner.html
 */

(function () {
    'use strict';

    window.mBT = window.mBT || {};
    window.mBT.tests = window.mBT.tests || {};
    window.mBT.tests.storage = window.mBT.tests.storage || {};

    // Test results tracking
    window.mBT.tests.storage.results = {
        passed: 0,
        failed: 0,
        tests: []
    };

    // Helper: Format test result
    window.mBT.tests.storage.result = function (name, passed, message) {
        var status = passed ? '✅ PASS' : '❌ FAIL';
        var result = {
            name: name,
            passed: passed,
            message: message,
            timestamp: new Date().toISOString()
        };
        window.mBT.tests.storage.results.tests.push(result);
        if (passed) {
            window.mBT.tests.storage.results.passed++;
        } else {
            window.mBT.tests.storage.results.failed++;
        }
        console.log('[mBT Storage Test]', status, '-', name);
        return result;
    };

    // =========================================
    // TEST: createProject
    // =========================================
    window.mBT.tests.storage.createProject = async function () {
        try {
            var testId = 'createProject-' + Date.now();
            var testData = {
                name: 'Test Project ' + Math.random().toString(36).substr(2, 9),
                budget: 50000,
                status: 'Draft',
                description: 'Test project created by test suite'
            };

            await window.mBT.storage.createProject(testData);

            var created = await window.mBT.storage.getProject(testId);
            var passed = created && created.name === testData.name;
            return window.mBT.tests.storage.result('createProject', passed, passed ? 'Project created successfully' : 'Failed to retrieve created project');
        } catch (e) {
            return window.mBT.tests.storage.result('createProject', false, 'Error: ' + e.message);
        }
    };

    // =========================================
    // TEST: getProject
    // =========================================
    window.mBT.tests.storage.getProject = async function () {
        try {
            // Create a project first
            var createResult = await window.mBT.tests.storage.createProject();
            if (!createResult.passed) return createResult;

            var testId = 'createProject-' + Date.now();
            var retrieved = await window.mBT.storage.getProject(testId);

            var passed = retrieved && retrieved.name && retrieved.budget;
            return window.mBT.tests.storage.result('getProject', passed, passed ? 'Project retrieved successfully' : 'Failed to retrieve project data');
        } catch (e) {
            return window.mBT.tests.storage.result('getProject', false, 'Error: ' + e.message);
        }
    };

    // =========================================
    // TEST: updateProject
    // =========================================
    window.mBT.tests.storage.updateProject = async function () {
        try {
            // Create a project
            var createResult = await window.mBT.tests.storage.createProject();
            if (!createResult.passed) return createResult;

            var testId = 'updateProject-' + Date.now();
            await window.mBT.storage.updateProject(testId, {
                name: 'Updated Project Name',
                status: 'Active'
            });

            var updated = await window.mBT.storage.getProject(testId);
            var passed = updated.name === 'Updated Project Name' && updated.status === 'Active';
            return window.mBT.tests.storage.result('updateProject', passed, passed ? 'Project updated successfully' : 'Update did not persist');
        } catch (e) {
            return window.mBT.tests.storage.result('updateProject', false, 'Error: ' + e.message);
        }
    };

    // =========================================
    // TEST: deleteProject
    // =========================================
    window.mBT.tests.storage.deleteProject = async function () {
        try {
            // Create a project
            var createResult = await window.mBT.tests.storage.createProject();
            if (!createResult.passed) return createResult;

            var testId = 'deleteProject-' + Date.now();
            await window.mBT.storage.deleteProject(testId);

            var deleted = await window.mBT.storage.getProject(testId);
            var passed = !deleted;
            return window.mBT.tests.storage.result('deleteProject', passed, passed ? 'Project deleted successfully' : 'Project still exists after deletion');
        } catch (e) {
            return window.mBT.tests.storage.result('deleteProject', false, 'Error: ' + e.message);
        }
    };

    // =========================================
    // TEST: getAllProjects
    // =========================================
    window.mBT.tests.storage.getAllProjects = async function () {
        try {
            // Create multiple projects
            for (var i = 0; i < 3; i++) {
                await window.mBT.storage.createProject({
                    name: 'Project ' + i,
                    budget: 50000 * (i + 1),
                    status: 'Draft'
                });
            }

            var all = await window.mBT.storage.getAllProjects();
            var passed = all && all.length >= 3;
            return window.mBT.tests.storage.result('getAllProjects', passed, passed ? 'Retrieved ' + all.length + ' projects' : 'Failed to retrieve all projects');
        } catch (e) {
            return window.mBT.tests.storage.result('getAllProjects', false, 'Error: ' + e.message);
        }
    };

    // =========================================
    // TEST: getAllStages
    // =========================================
    window.mBT.tests.storage.getAllStages = async function () {
        try {
            var stages = await window.mBT.storage.getAllStages();
            var passed = Array.isArray(stages);
            return window.mBT.tests.storage.result('getAllStages', passed, passed ? 'Stages retrieved: ' + (stages.length || 0) + ' items' : 'Failed to retrieve stages');
        } catch (e) {
            return window.mBT.tests.storage.result('getAllStages', false, 'Error: ' + e.message);
        }
    };

    // =========================================
    // TEST: getStagesByProject
    // =========================================
    window.mBT.tests.storage.getStagesByProject = async function () {
        try {
            var stages = await window.mBT.storage.getAllStages();
            var testId = 'stages-' + Date.now();
            var filtered = await window.mBT.storage.getStagesByProject(testId);
            var passed = filtered && (Array.isArray(filtered) || filtered === null);
            return window.mBT.tests.storage.result('getStagesByProject', passed, passed ? 'Filtered stages retrieved' : 'Failed to filter stages by project');
        } catch (e) {
            return window.mBT.tests.storage.result('getStagesByProject', false, 'Error: ' + e.message);
        }
    };

    // =========================================
    // TEST: getProjectIdFromName
    // =========================================
    window.mBT.tests.storage.getProjectIdFromName = async function () {
        try {
            // Create a project with known name
            var testId = 'nameTest-' + Date.now();
            await window.mBT.storage.createProject({
                name: 'Known Test Project',
                budget: 25000,
                status: 'Planning'
            });

            var foundId = await window.mBT.storage.getProjectIdFromName('Known Test Project');
            var passed = foundId === testId;
            return window.mBT.tests.storage.result('getProjectIdFromName', passed, passed ? 'Project ID retrieved from name' : 'Failed to find project by name');
        } catch (e) {
            return window.mBT.tests.storage.result('getProjectIdFromName', false, 'Error: ' + e.message);
        }
    };

    // =========================================
    // TEST: getStageById
    // =========================================
    window.mBT.tests.storage.getStageById = async function () {
        try {
            // Create a stage
            var testId = 'stage-' + Date.now();
            await window.mBT.storage.createStage(testId, {
                description: 'Test Stage',
                budgeted: 10000,
                projectId: testId
            });

            var retrieved = await window.mBT.storage.getStageById(testId);
            var passed = retrieved && retrieved.description === 'Test Stage';
            return window.mBT.tests.storage.result('getStageById', passed, passed ? 'Stage retrieved by ID' : 'Failed to retrieve stage by ID');
        } catch (e) {
            return window.mBT.tests.storage.result('getStageById', false, 'Error: ' + e.message);
        }
    };

    // =========================================
    // TEST: getStagesByProject (with projectId)
    // =========================================
    window.mBT.tests.storage.getStagesByProject = async function () {
        try {
            // Create a project and stage
            var projectId = 'projectStages-' + Date.now();
            await window.mBT.storage.createProject({
                name: 'Project for Stage Test',
                budget: 100000,
                status: 'Active'
            });
            await window.mBT.storage.updateProject(projectId, { name: 'Project for Stage Test' });

            var testStageId = 'testStage-' + Date.now();
            await window.mBT.storage.createStage(testStageId, {
                description: 'Test Stage for Project',
                budgeted: 5000,
                projectId: projectId
            });

            var stages = await window.mBT.storage.getStagesByProject(projectId);
            var passed = stages && stages.length >= 1;
            return window.mBT.tests.storage.result('getStagesByProject', passed, passed ? 'Retrieved ' + stages.length + ' stages for project' : 'Failed to retrieve stages for project');
        } catch (e) {
            return window.mBT.tests.storage.result('getStagesByProject', false, 'Error: ' + e.message);
        }
    };

    // =========================================
    // TEST: Contact CRUD operations
    // =========================================
    window.mBT.tests.storage.contactCRUD = async function () {
        try {
            var testId = 'contact-' + Date.now();
            
            // Create
            var created = await window.mBT.storage.createContact(testId, {
                name: 'Test Contact',
                email: 'test@example.com',
                department: 'Production'
            });

            // Read
            var retrieved = await window.mBT.storage.getContact(testId);

            // Update
            await window.mBT.storage.updateContact(testId, { email: 'updated@example.com' });
            var updated = await window.mBT.storage.getContact(testId);

            // Delete
            await window.mBT.storage.deleteContact(testId);
            var deleted = await window.mBT.storage.getContact(testId);

            var passed = created && retrieved.email === 'test@example.com' && 
                         updated.email === 'updated@example.com' && 
                         !deleted;
            return window.mBT.tests.storage.result('contactCRUD', passed, passed ? 'All CRUD operations passed' : 'Some CRUD operations failed');
        } catch (e) {
            return window.mBT.tests.storage.result('contactCRUD', false, 'Error: ' + e.message);
        }
    };

    // =========================================
    // TEST: All stores exist
    // =========================================
    window.mBT.tests.storage.storesExist = async function () {
        try {
            var stores = ['projects', 'stages', 'executions', 'og_ref', 'contacts', 'sessions'];
            var allExist = true;
            var missing = [];

            for (var i = 0; i < stores.length; i++) {
                var exists = await window.mBT.storage.checkStore(stores[i]);
                if (!exists) {
                    allExist = false;
                    missing.push(stores[i]);
                }
            }

            return window.mBT.tests.storage.result('storesExist', allExist, allExist ? 'All stores exist' : 'Missing stores: ' + missing.join(', '));
        } catch (e) {
            return window.mBT.tests.storage.result('storesExist', false, 'Error: ' + e.message);
        }
    };

    // =========================================
    // TEST: Schema validation
    // =========================================
    window.mBT.tests.storage.schemaValidation = async function () {
        try {
            var validation = window.mBT.storage.validateSchema();
            var passed = validation.valid;
            return window.mBT.tests.storage.result('schemaValidation', passed, passed ? 'Schema is valid' : 'Schema validation failed: ' + (validation.errors || []).join(', '));
        } catch (e) {
            return window.mBT.tests.storage.result('schemaValidation', false, 'Error: ' + e.message);
        }
    };

    // =========================================
    // RUN ALL TESTS
    // =========================================
    window.mBT.tests.storage.runAll = async function () {
        console.log('[mBT Storage Test] Running all tests...\n');

        var tests = [
            window.mBT.tests.storage.createProject,
            window.mBT.tests.storage.getProject,
            window.mBT.tests.storage.updateProject,
            window.mBT.tests.storage.deleteProject,
            window.mBT.tests.storage.getAllProjects,
            window.mBT.tests.storage.getAllStages,
            window.mBT.tests.storage.getStagesByProject,
            window.mBT.tests.storage.getProjectIdFromName,
            window.mBT.tests.storage.getStageById,
            window.mBT.tests.storage.contactCRUD,
            window.mBT.tests.storage.storesExist,
            window.mBT.tests.storage.schemaValidation
        ];

        for (var i = 0; i < tests.length; i++) {
            var test = tests[i];
            await test();
        }

        console.log('\n[mBT Storage Test] Results:');
        console.log('  Passed:', window.mBT.tests.storage.results.passed);
        console.log('  Failed:', window.mBT.tests.storage.results.failed);
        console.log('  Total:', window.mBT.tests.storage.results.passed + window.mBT.tests.storage.results.failed);

        return window.mBT.tests.storage.results;
    };

})();