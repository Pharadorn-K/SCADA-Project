// frontend/public/js/routes.js
import * as Home from './views/home.js';
import * as Production from './views/production.js';
import * as Maintenance from './views/maintenance.js';
import * as Admin from './views/admin.js';
import * as OEE from './views/oee.js';

export const routes = {
  home: {
    view: Home.homeView,
    mount: Home.homeMount,
    unmount: Home.homeUnmount
  },

  production: {
    overview: {
      mount: Production.productionOverviewMount,
      unmount: Production.productionOverviewUnmount
    },
    machine_efficiency: {
      view: Production.productionMachineEfficiencyView
    },
    production_history: {
      view: Production. productionProductionHistoryView
    },
    staff_management: {
      view: Production.productionStaffManagementView
    }
  },

  maintenance: {
    overview: {
      plant1: { view: Maintenance.plant1View },
      plant2: { view: Maintenance.plant2View }
    },
    request: { view: Maintenance.requestView },
    report: { view: Maintenance.reportView }
  },

  oee: {
    mount: OEE.oeeMount,
    unmount: OEE.oeeUnmount
  },  

  admin: {
    alarm: {
      view: Admin.adminAlarmView,
      mount: Admin.adminAlarmMount,
      unmount: Admin.adminAlarmUnmount,
      role: 'admin'
    },
    database: {
      view: Admin.adminDatabaseView,
      role: 'admin'
    }
  }

};
