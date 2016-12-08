const coreApp = require('kolibri');
const logging = require('kolibri.lib.logging');

const FacilityUserResource = coreApp.resources.FacilityUserResource;
const TaskResource = coreApp.resources.TaskResource;
const RoleResource = coreApp.resources.RoleResource;

const coreActions = require('kolibri.coreVue.vuex.actions');
const ConditionalPromise = require('kolibri.lib.conditionalPromise');
const constants = require('./state/constants');
const UserKinds = require('kolibri.coreVue.vuex.constants').UserKinds;
const PageNames = constants.PageNames;
const ContentWizardPages = constants.ContentWizardPages;
const samePageCheckGenerator = require('kolibri.coreVue.vuex.actions').samePageCheckGenerator;


// ================================
// USER MANAGEMENT ACTIONS


/**
 * Vuex State Mappers
 *
 * The methods below help map data from
 * the API to state in the Vuex store
 */

function _stateUser(apiUserData) {
  // handle role representation
  let kind = UserKinds.LEARNER;
  let kindID = 0;

  // look through all roles in array to make sure we get the one with the most power
  // TODO ask if they're inside the array in order of heirarchy
  // console.log(apiUserData);
  apiUserData.roles.forEach(role => {
    // using a switch statement. Checks all in order of heirarchy
    switch(role.kind){
      // sets role to admin 
      case UserKinds.ADMIN || UserKinds.SUPERUSER:
        kind = UserKinds.ADMIN;
        kindID = role.id;
        break;
      case UserKinds.COACH:
        if(kind != UserKinds.ADMIN) kind = UserKinds.COACH;
        kindID = role.id;
        break;
    }
  });

  return {
    id: apiUserData.id,
    facility_id: apiUserData.facility,
    username: apiUserData.username,
    full_name: apiUserData.full_name,
    kind: kind, 
    kindID: kindID,
  };
}

function _taskState(data) {
  const state = {
    id: data.id,
    type: data.type,
    status: data.status,
    metadata: data.metadata,
    percentage: data.percentage,
  };
  return state;
}

/**
 * Title Helper
 */

function _managePageTitle(title) {
  return `Manage ${title}`;
}


/**
 * Actions
 *
 * These methods are used to update client-side state
 */

/**
 * Does a POST request to assign a user role (only used in this file)
 * MIGHT NOT NEED TO DO THIS. ASK SOMEONE AT WORK TOMORROW
 */
function assignUserRole(user, kind){
  const rolePayload = {
        user: user.id,
        collection: user.facility,
        kind: kind,
      };
  
  return new Promise((resolve, reject) => {
    // just in case we pass in learner
    if(kind === userKinds.LEARNER){
      resolve(user);
      console.log('was learner');
    }
    else{
      console.log('gonna create new role');
      RoleResource.createModel(rolePayload).save().then((roleModel)=>{
        console.log(roleModel);
        user.roles.push(roleModel);
        resolve(user);

        // not working, despite the force flag. Might take a while to update the users?
        // resolve(FacilityUserResource.getModel(user.id, true).attributes);
      },(error)=>{
        coreActions.handleApiError(store, error); 
        reject(error);
      });
    }
  });
}

/**
 * Do a POST to create new user
 * @param {object} userData
 *  Needed: username, full_name, facility, role, password
 * @param {string} role
 */
function createUser(store, stateUserData) {
  const userData = {
    facility: stateUserData.facility,
    username: stateUserData.username,
    full_name: stateUserData.full_name,
    password: stateUserData.password,
  }

  return new Promise((resolve, reject) => {
    FacilityUserResource.createModel(userData).save().then((userModel) => {
      
      assignUserRole(userModel, stateUserData.kind).then((userWithRole)=>{
        store.dispatch('ADD_USER', _stateUser(userWithRole));
        resolve();
      }, error => reject(error));
      
    },(error) => {
      // coreActions.handleApiError(store, error); 
      reject(error);
    });
  });

}

/**
 * Do a PATCH to update existing user
 * @param {string} id
 * @param {object} payload
 * @param {string} role
 */
function updateUser(store, stateUser) {
  //payload needs username, fullname, and facility
  const userID = stateUser.id;
  console.log('kindID');
  const kindID = stateUser.kindID;
  const savedUserModel = FacilityUserResource.getModel(userID);

  // used for comparisons
  let savedUser = _stateUser(savedUserModel.attributes);
  console.log('State user data:');
  console.log(stateUser);
  console.log('Saved user data:');
  console.log(savedUser);

  let changedValues = {};

  // explicit checks for the only values that should be changed
  if(stateUser.full_name !== savedUser.full_name)
    changedValues.full_name = stateUser.full_name;

  if(stateUser.username !== savedUser.username)
    changedValues.username = stateUser.username;

  if(stateUser.password !== savedUser.password)
    changedValues.password = stateUser.password;

  if(stateUser.facility !== savedUser.facility)
    changedValues.facility = stateUser.facility;

  savedUserModel.save(changedValues).then((updatedUser)=>{
    savedUser = updatedUser;
  });
  
  if(stateUser.kind !== savedUser.kind){
    console.log('kind was changed');
    let canAddNewRole = false;
  
    // delete the old role Model if it existed
    if(savedUser.kind != UserKinds.LEARNER){
      console.log('going to have to wait for the old role to be deleted');
      canAddNewRole = RoleResource.getModel(kindID).delete();
    }else{
      console.log('no need for delete');
    }

    // then assign the new role.
    console.log(canAddNewRole);
    Promise.resolve(canAddNewRole).then(() => {
      console.log('assigning the new user role');
      assignUserRole(stateUser, stateUser.kind).then(() => {
        console.log('assigned new role');
      },(error) => {
        // couldn't assign role
        console.log('assign new role fail');
        coreActions.handleApiError(store, error); 
      });
    }, (error) => {
      console.log('delete old role fail');
      coreActions.handleApiError(store, error); 
    });
  }
}

/**
 * Do a DELETE to delete the user.
 * @param {string or Integer} id
 */
function deleteUser(store, id) {
  if (!id) {
    // if no id passed, abort the function
    return;
  }
  FacilityUserResource.getModel(id).delete().then(user => {
    store.dispatch('DELETE_USER', id);
  }, error => { coreActions.handleApiError(store, error); });
}

// An action for setting up the initial state of the app by fetching data from the server
function showUserPage(store) {
  store.dispatch('CORE_SET_PAGE_LOADING', true);
  store.dispatch('SET_PAGE_NAME', PageNames.USER_MGMT_PAGE);
  const userCollection = FacilityUserResource.getCollection();
  const facilityIdPromise = FacilityUserResource.getCurrentFacility();
  const userPromise = userCollection.fetch();

  const promises = [facilityIdPromise, userPromise];

  ConditionalPromise.all(promises).only(
    samePageCheckGenerator(store),
    ([facilityId, users]) => {
      store.dispatch('SET_FACILITY', facilityId[0]); // for mvp, we assume only one facility exists

      const pageState = {
        users: users.map(_stateUser),
      };

      store.dispatch('SET_PAGE_STATE', pageState);
      store.dispatch('CORE_SET_PAGE_LOADING', false);
      store.dispatch('CORE_SET_ERROR', null);
      store.dispatch('CORE_SET_TITLE', _managePageTitle('Users'));
    },
    error => { coreActions.handleApiError(store, error); }
  );
}


// ================================
// CONTENT IMPORT/EXPORT ACTIONS


function showContentPage(store) {
  store.dispatch('CORE_SET_PAGE_LOADING', true);
  store.dispatch('SET_PAGE_NAME', PageNames.CONTENT_MGMT_PAGE);
  const taskCollectionPromise = TaskResource.getCollection().fetch();
  taskCollectionPromise.only(
    samePageCheckGenerator(store),
    (taskList) => {
      const pageState = {
        taskList: taskList.map(_taskState),
        wizardState: { shown: false },
      };
      coreActions.setChannelInfo(store, coreApp).then(() => {
        store.dispatch('SET_PAGE_STATE', pageState);
        store.dispatch('CORE_SET_PAGE_LOADING', false);
        store.dispatch('CORE_SET_TITLE', _managePageTitle('Content'));
      });
    },
    error => { coreActions.handleApiError(store, error); }
  );
}

function updateWizardLocalDriveList(store) {
  const localDrivesPromise = TaskResource.localDrives();
  store.dispatch('SET_CONTENT_PAGE_WIZARD_BUSY', true);
  localDrivesPromise.then((response) => {
    store.dispatch('SET_CONTENT_PAGE_WIZARD_BUSY', false);
    store.dispatch('SET_CONTENT_PAGE_WIZARD_DRIVES', response.entity);
  })
  .catch((error) => {
    store.dispatch('SET_CONTENT_PAGE_WIZARD_BUSY', false);
    coreActions.handleApiError(store, error);
  });
}

function startImportWizard(store) {
  store.dispatch('SET_CONTENT_PAGE_WIZARD_STATE', {
    shown: true,
    page: ContentWizardPages.CHOOSE_IMPORT_SOURCE,
    error: null,
    busy: false,
    drivesLoading: false,
    driveList: null,
  });
}

function startExportWizard(store) {
  store.dispatch('SET_CONTENT_PAGE_WIZARD_STATE', {
    shown: true,
    page: ContentWizardPages.EXPORT,
    error: null,
    busy: false,
    drivesLoading: false,
    driveList: null,
  });
  updateWizardLocalDriveList(store);
}

function showImportNetworkWizard(store) {
  store.dispatch('SET_CONTENT_PAGE_WIZARD_STATE', {
    shown: true,
    page: ContentWizardPages.IMPORT_NETWORK,
    error: null,
    busy: false,
    drivesLoading: false,
    driveList: null,
  });
}

function showImportLocalWizard(store) {
  store.dispatch('SET_CONTENT_PAGE_WIZARD_STATE', {
    shown: true,
    page: ContentWizardPages.IMPORT_LOCAL,
    error: null,
    busy: false,
    drivesLoading: false,
    driveList: null,
  });
  updateWizardLocalDriveList(store);
}

function cancelImportExportWizard(store) {
  store.dispatch('SET_CONTENT_PAGE_WIZARD_STATE', {
    shown: false,
    error: null,
    busy: false,
    drivesLoading: false,
    driveList: null,
  });
}

// called from a timer to continually update UI
function pollTasksAndChannels(store) {
  const samePageCheck = samePageCheckGenerator(store);
  TaskResource.getCollection().fetch({}, true).only(
    // don't handle response if we've switched pages or if we're in the middle of another operation
    () => samePageCheck() && !store.state.pageState.wizardState.busy,
    (taskList) => {
      // Perform channel poll AFTER task poll to ensure UI is always in a consistent state.
      // I.e. channel list always reflects the current state of ongoing task(s).
      coreActions.setChannelInfo(store, coreApp).only(
        samePageCheckGenerator(store),
        () => {
          store.dispatch('SET_CONTENT_PAGE_TASKS', taskList.map(_taskState));
          // Close the wizard if there's an outstanding task.
          // (this can be removed when we support more than one
          // concurrent task.)
          if (taskList.length && store.state.pageState.wizardState.shown) {
            cancelImportExportWizard(store);
          }
        }
      );
    },
    error => { logging.error(`poll error: ${error}`); }
  );
}

function clearTask(store, taskId) {
  const clearTaskPromise = TaskResource.clearTask(taskId);
  clearTaskPromise.then(() => {
    store.dispatch('SET_CONTENT_PAGE_TASKS', []);
  })
  .catch(error => { coreActions.handleApiError(store, error); });
}

function triggerLocalContentImportTask(store, driveId) {
  store.dispatch('SET_CONTENT_PAGE_WIZARD_BUSY', true);
  const localImportPromise = TaskResource.localImportContent(driveId);
  localImportPromise.then((response) => {
    store.dispatch('SET_CONTENT_PAGE_TASKS', [_taskState(response.entity)]);
    cancelImportExportWizard(store);
  })
  .catch((error) => {
    store.dispatch('SET_CONTENT_PAGE_WIZARD_ERROR', error.status.text);
    store.dispatch('SET_CONTENT_PAGE_WIZARD_BUSY', false);
  });
}

function triggerLocalContentExportTask(store, driveId) {
  store.dispatch('SET_CONTENT_PAGE_WIZARD_BUSY', true);
  const localExportPromise = TaskResource.localExportContent(driveId);
  localExportPromise.then((response) => {
    store.dispatch('SET_CONTENT_PAGE_TASKS', [_taskState(response.entity)]);
    cancelImportExportWizard(store);
  })
  .catch((error) => {
    store.dispatch('SET_CONTENT_PAGE_WIZARD_ERROR', error.status.text);
    store.dispatch('SET_CONTENT_PAGE_WIZARD_BUSY', false);
  });
}

function triggerRemoteContentImportTask(store, channelId) {
  store.dispatch('SET_CONTENT_PAGE_WIZARD_BUSY', true);
  const remoteImportPromise = TaskResource.remoteImportContent(channelId);
  remoteImportPromise.then((response) => {
    store.dispatch('SET_CONTENT_PAGE_TASKS', [_taskState(response.entity)]);
    cancelImportExportWizard(store);
  })
  .catch((error) => {
    if (error.status.code === 404) {
      store.dispatch('SET_CONTENT_PAGE_WIZARD_ERROR', 'That ID was not found on our server.');
    } else {
      store.dispatch('SET_CONTENT_PAGE_WIZARD_ERROR', error.status.text);
    }
    store.dispatch('SET_CONTENT_PAGE_WIZARD_BUSY', false);
  });
}


// ================================
// OTHER ACTIONS


function showDataPage(store) {
  store.dispatch('SET_PAGE_NAME', PageNames.DATA_EXPORT_PAGE);
  store.dispatch('SET_PAGE_STATE', {});
  store.dispatch('CORE_SET_PAGE_LOADING', false);
  store.dispatch('CORE_SET_ERROR', null);
  store.dispatch('CORE_SET_TITLE', _managePageTitle('Data'));
}

function showScratchpad(store) {
  store.dispatch('SET_PAGE_NAME', PageNames.SCRATCHPAD);
  store.dispatch('SET_PAGE_STATE', {});
  store.dispatch('CORE_SET_PAGE_LOADING', false);
  store.dispatch('CORE_SET_ERROR', null);
  store.dispatch('CORE_SET_TITLE', _managePageTitle('Scratchpad'));
}

module.exports = {
  createUser,
  updateUser,
  deleteUser,
  showUserPage,

  showContentPage,
  pollTasksAndChannels,
  clearTask,
  startImportWizard,
  startExportWizard,
  showImportNetworkWizard,
  showImportLocalWizard,
  cancelImportExportWizard,
  triggerLocalContentExportTask,
  triggerLocalContentImportTask,
  triggerRemoteContentImportTask,
  updateWizardLocalDriveList,

  showDataPage,
  showScratchpad,
};
