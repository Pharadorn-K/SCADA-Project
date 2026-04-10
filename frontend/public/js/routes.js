// frontend/public/js/routes.js
import * as Home from './views/home.js';
import * as Production from './views/production.js';
import * as Maintenance from './views/maintenance.js';
import * as Admin from './views/admin.js';

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
      view: Production.productionMachineEfficiencyView,
      mount: Production.productionMachineEfficiencyMount,
      unmount: Production.productionMachineEfficiencyUnmount
    },
    production_history: {
      view: Production. productionProductionHistoryView,
      mount: Production. productionProductionHistoryMount,
      unmount: Production. productionProductionHistoryUnmount
    },
    staff_management: {
      view: Production.productionStaffManagementView
    }
  },

  maintenance: {
    overview: {
      plant1: { view: Maintenance.maintenanceplant1View },
      plant2: { view: Maintenance.maintenanceplant2View }
    },
    request: { view: Maintenance.maintenancerequestView },
    report: { view: Maintenance.maintenancereportView }
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
