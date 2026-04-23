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
    window.mBT.tests.storage.createProject = function () {
        var self = this;
        var testId = 'createProject-' + Date.now();
        var testData = {
            name: 'Test Project ' + Math.random().toString(36).substr(2, 9),
            budget: 50000,
            status: 'Draft',
            description: 'Test project created by test suite'
        };

        return window.mBT.storage.createProject(testData)
            .then(function () {
                return window.mBT.storage.getProject(testId);
            })
            .then(function (created) {
                var passed = created && created.name === testData.name;
                return window.mBT.tests.storage.result('createProject', passed, passed ? 'Project created successfully' : 'Failed to retrieve created project');
            })
            .catch(function (e) {
                return window.mBT.tests.storage.result('createProject', false, 'Error: ' + e.message);
            });
    };

    // =========================================
    // TEST: getProject
    // =========================================
    window.mBT.tests.storage.getProject = function () {
        var self = this;
        return window.mBT.tests.storage.createProject()
            .then(function (createResult) {
                if (!createResult.passed) return createResult;

                var testId = 'createProject-' + Date.now();
                return window.mBT.storage.getProject(testId).then(function (retrieved) {
                    var passed = retrieved && retrieved.name && retrieved.budget;
                    return window.mBT.tests.storage.result('getProject', passed, passed ? 'Project retrieved successfully' : 'Failed to retrieve project data');
                });
            })
            .catch(function (e) {
                return window.mBT.tests.storage.result('getProject', false, 'Error: ' + e.message);
            });
    };

    // =========================================
    // TEST: updateProject
    // =========================================
    window.mBT.tests.storage.updateProject = function () {
        var self = this;
        return window.mBT.tests.storage.createProject()
            .then(function (createResult) {
                if (!createResult.passed) return createResult;

                var testId = 'updateProject-' + Date.now();
                return window.mBT.storage.updateProject(testId, {
                    name: 'Updated Project Name',
                    status: 'Active'
                }).then(function () {
                    return window.mBT.storage.getProject(testId);
                }).then(function (updated) {
                    var passed = updated.name === 'Updated Project Name' && updated.status === 'Active';
                    return window.mBT.tests.storage.result('updateProject', passed, passed ? 'Project updated successfully' : 'Update did not persist');
                });
            })
            .catch(function (e) {
                return window.mBT.tests.storage.result('updateProject', false, 'Error: ' + e.message);
            });
    };

    // =========================================
    // TEST: deleteProject
    // =========================================
    window.mBT.tests.storage.deleteProject = function () {
        var self = this;
        return window.mBT.tests.storage.createProject()
            .then(function (createResult) {
                if (!createResult.passed) return createResult;

                var testId = 'deleteProject-' + Date.now();
                return window.mBT.storage.deleteProject(testId).then(function () {
                    return window.mBT.storage.getProject(testId);
                }).then(function (deleted) {
                    var passed = !deleted;
                    return window.mBT.tests.storage.result('deleteProject', passed, passed ? 'Project deleted successfully' : 'Project still exists after deletion');
                });
            })
            .catch(function (e) {
                return window.mBT.tests.storage.result('deleteProject', false, 'Error: ' + e.message);
            });
    };

    // =========================================
    // TEST: getAllProjects
    // =========================================
    window.mBT.tests.storage.getAllProjects = function () {
        var self = this;
        var p = Promise.resolve();
        for (var i = 0; i < 3; i++) {
            (function(idx) {
                p = p.then(function() {
                    return window.mBT.storage.createProject({
                        name: 'Project ' + idx,
                        budget: 50000 * (idx + 1),
                        status: 'Draft'
                    });
                });
            })(i);
        }

        return p.then(function () {
            return window.mBT.storage.getAllProjects();
        }).then(function (all) {
            var passed = all && all.length >= 3;
            return window.mBT.tests.storage.result('getAllProjects', passed, passed ? 'Retrieved ' + all.length + ' projects' : 'Failed to retrieve all projects');
        }).catch(function (e) {
            return window.mBT.tests.storage.result('getAllProjects', false, 'Error: ' + e.message);
        });
    };

    // =========================================
    // TEST: getAllStages
    // =========================================
    window.mBT.tests.storage.getAllStages = function () {
        return window.mBT.storage.getAllStages()
            .then(function (stages) {
                var passed = Array.isArray(stages);
                return window.mBT.tests.storage.result('getAllStages', passed, passed ? 'Stages retrieved: ' + (stages.length || 0) + ' items' : 'Failed to retrieve stages');
            })
            .catch(function (e) {
                return window.mBT.tests.storage.result('getAllStages', false, 'Error: ' + e.message);
            });
    };

    // =========================================
    // TEST: getProjectIdFromName
    // =========================================
    window.mBT.tests.storage.getProjectIdFromName = function () {
        var testId = 'nameTest-' + Date.now();
        return window.mBT.storage.createProject({
            name: 'Known Test Project',
            budget: 25000,
            status: 'Planning'
        }).then(function () {
            return window.mBT.storage.getProjectIdFromName('Known Test Project');
        }).then(function (foundId) {
            var passed = foundId === testId;
            return window.mBT.tests.storage.result('getProjectIdFromName', passed, passed ? 'Project ID retrieved from name' : 'Failed to find project by name');
        }).catch(function (e) {
            return window.mBT.tests.storage.result('getProjectIdFromName', false, 'Error: ' + e.message);
        });
    };

    // =========================================
    // TEST: getStageById
    // =========================================
    window.mBT.tests.storage.getStageById = function () {
        var testId = 'stage-' + Date.now();
        return window.mBT.storage.createStage(testId, {
            description: 'Test Stage',
            budgeted: 10000,
            projectId: testId
        }).then(function () {
            return window.mBT.storage.getStageById(testId);
        }).then(function (retrieved) {
            var passed = retrieved && retrieved.description === 'Test Stage';
            return window.mBT.tests.storage.result('getStageById', passed, passed ? 'Stage retrieved by ID' : 'Failed to retrieve stage by ID');
        }).catch(function (e) {
            return window.mBT.tests.storage.result('getStageById', false, 'Error: ' + e.message);
        });
    };

    // =========================================
    // TEST: getStagesByProject
    // =========================================
    window.mBT.tests.storage.getStagesByProject = function () {
        var projectId = 'projectStages-' + Date.now();
        return window.mBT.storage.createProject({
            name: 'Project for Stage Test',
            budget: 100000,
            status: 'Active'
        }).then(function () {
            return window.mBT.storage.updateProject(projectId, { name: 'Project for Stage Test' });
        }).then(function () {
            var testStageId = 'testStage-' + Date.now();
            return window.mBT.storage.createStage(testStageId, {
                description: 'Test Stage for Project',
                budgeted: 5000,
                projectId: projectId
            });
        }).then(function () {
            return window.mBT.storage.getStagesByProject(projectId);
        }).then(function (stages) {
            var passed = stages && stages.length >= 1;
            return window.mBT.tests.storage.result('getStagesByProject', passed, passed ? 'Retrieved ' + stages.length + ' stages for project' : 'Failed to retrieve stages for project');
        }).catch(function (e) {
            return window.mBT.tests.storage.result('getStagesByProject', false, 'Error: ' + e.message);
        });
    };

    // =========================================
    // TEST: Contact CRUD operations
    // =========================================
    window.mBT.tests.storage.contactCRUD = function () {
        var testId = 'contact-' + Date.now();
        var created, retrieved, updated, deleted;
        
        return window.mBT.storage.createContact(testId, {
            name: 'Test Contact',
            email: 'test@example.com',
            department: 'Production'
        }).then(function (res) {
            created = res;
            return window.mBT.storage.getContact(testId);
        }).then(function (res) {
            retrieved = res;
            return window.mBT.storage.updateContact(testId, { email: 'updated@example.com' });
        }).then(function () {
            return window.mBT.storage.getContact(testId);
        }).then(function (res) {
            updated = res;
            return window.mBT.storage.deleteContact(testId);
        }).then(function () {
            return window.mBT.storage.getContact(testId);
        }).then(function (res) {
            deleted = res;
            var passed = created && retrieved.email === 'test@example.com' && 
                         updated.email === 'updated@example.com' && 
                         !deleted;
            return window.mBT.tests.storage.result('contactCRUD', passed, passed ? 'All CRUD operations passed' : 'Some CRUD operations failed');
        }).catch(function (e) {
            return window.mBT.tests.storage.result('contactCRUD', false, 'Error: ' + e.message);
        });
    };

    // =========================================
    // TEST: All stores exist
    // =========================================
    window.mBT.tests.storage.storesExist = function () {
        var stores = ['projects', 'stages', 'executions', 'og_ref', 'contacts', 'sessions'];
        var allExist = true;
        var missing = [];

        var p = Promise.resolve();
        for (var i = 0; i < stores.length; i++) {
            (function(s) {
                p = p.then(function() {
                    return window.mBT.storage.checkStore(s).then(function(exists) {
                        if (!exists) {
                            allExist = false;
                            missing.push(s);
                        }
                    });
                });
            })(stores[i]);
        }

        return p.then(function () {
            return window.mBT.tests.storage.result('storesExist', allExist, allExist ? 'All stores exist' : 'Missing stores: ' + missing.join(', '));
        }).catch(function (e) {
            return window.mBT.tests.storage.result('storesExist', false, 'Error: ' + e.message);
        });
    };

    // =========================================
    // TEST: Schema validation
    // =========================================
    window.mBT.tests.storage.schemaValidation = function () {
        try {
            var validation = window.mBT.storage.validateSchema();
            var passed = validation.valid;
            return Promise.resolve(window.mBT.tests.storage.result('schemaValidation', passed, passed ? 'Schema is valid' : 'Schema validation failed: ' + (validation.errors || []).join(', ')));
        } catch (e) {
            return Promise.resolve(window.mBT.tests.storage.result('schemaValidation', false, 'Error: ' + e.message));
        }
    };

    // =========================================
    // RUN ALL TESTS
    // =========================================
    window.mBT.tests.storage.runAll = function () {
        console.log('[mBT Storage Test] Running all tests..\n');

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

        var p = Promise.resolve();
        for (var i = 0; i < tests.length; i++) {
            (function(t) {
                p = p.then(function() { return t(); });
            })(tests[i]);
        }

        return p.then(function () {
            console.log('\n[mBT Storage Test] Results:');
            console.log('  Passed:', window.mBT.tests.storage.results.passed);
            console.log('  Failed:', window.mBT.tests.storage.results.failed);
            console.log('  Total:', window.mBT.tests.storage.results.passed + window.mBT.tests.storage.results.failed);

            return window.mBT.tests.storage.results;
        });
    };

})();
