import _ from 'lodash';
import angular from 'angular';
import moment from 'moment';

import $ from 'jquery';

import * as rangeUtil from 'app/core/utils/rangeutil';

//import { PanelEditor } from './PanelEditor';

export class TimePickerCtrl {
  static tooltipFormat = 'MMM D, YYYY HH:mm:ss';
  static defaults = {
    time_options: ['5m', '15m', '1h', '6h', '12h', '24h', '2d', '7d', '30d'],
    refresh_intervals: ['5s', '10s', '30s', '1m', '5m', '15m', '30m', '1h', '2h', '1d'],
  };

  dashboard: any;
  panel: any;
  absolute: any;
  timeRaw: any;
  editTimeRaw: any;
  tooltip: string;
  rangeString: string;
  timeOptions: any;
  refresh: any;
  isUtc: boolean;
  firstDayOfWeek: number;
  isOpen: boolean;
  isAbsolute: boolean;
  startingTimeRange: any;

  queryTroubleshooterOpen: boolean;
  helpOpen: boolean;
  optionsOpen: boolean;

  currentAnnotation: any;
  currentDatasource: any;
  datasources: any;
  rawSql: any;

  //storedQuery: any;

  annotationDefaults: any = {
    name: '',
    datasource: null,
    iconColor: 'rgba(255, 96, 96, 1)',
    enable: true,
    showIn: 0,
    hide: false,
  };

  /** @ngInject */
  constructor(private $scope, private $rootScope, private datasourceSrv, private timeSrv) {
    this.$scope.ctrl = this;

    $rootScope.onAppEvent('shift-time-forward', () => this.move(1), $scope);
    $rootScope.onAppEvent('shift-time-backward', () => this.move(-1), $scope);
    $rootScope.onAppEvent('closeTimepicker', this.openDropdown.bind(this), $scope);

    this.dashboard.on('refresh', this.onRefresh.bind(this), $scope);

    // init options
    this.panel = this.dashboard.timepicker;
    _.defaults(this.panel, TimePickerCtrl.defaults);
    this.firstDayOfWeek = moment.localeData().firstDayOfWeek();

    // init time stuff
    this.$scope.startingTimeRange = this.timeSrv.timeRange();

    this.datasources = this.datasourceSrv.getAnnotationSources();

    this.currentAnnotation = angular.copy(this.annotationDefaults);
    //this.currentAnnotation.datasource = this.datasources[0].name;

    this.currentAnnotation.datasource = this.$scope.ctrl.panel.datasourceName;
    //this.currentAnnotation.datasource = this.currentDatasource.name;
    // TODO: store the result of the query that gets the most recent time:

    this.onRefresh();

    this.datasourceChanged();

    this.$scope.ctrl.rawSql = this.$scope.ctrl.storedQuery;

    $('code-editor .ace_content .ace_identifier').text(this.$scope.ctrl.panel.storedQuery);

    console.log('CURRENT SQL: ' + this.$scope.ctrl.storedQuery);
  }

  saveTimeCheckQuery() {
    this.$scope.ctrl.rawSql = $('code-editor .ace_content .ace_text-layer')
      .children()
      .eq(0)
      .text();
    this.$scope.ctrl.storedQuery = this.$scope.ctrl.rawSql;

    this.$scope.ctrl.panel.storedQuery = this.$scope.ctrl.storedQuery;

    console.log(this.$scope.ctrl);

    /*

            timezone: 'browser',
        panelId: panelId,
        dashboardId: dashboardId,
        range: timeRange,
        rangeRaw: timeRange.raw,
        interval: '1s',
        intervalMs: 60000,
        targets: queries,
        maxDataPoints: 500,
        scopedVars: {},
        cacheTimeout: null,
        */

    // https://github.com/grafana/grafana/blob/master/docs/sources/plugins/developing/datasources.md

    const rangeRaw = {
      from: 'now-6h',
      to: 'now',
    };

    const range = {
      from: '2016-10-31T06:33:44.866Z',
      to: '2045-10-31T12:33:44.866Z',
      raw: rangeRaw,
    };

    const metricsQuery = {
      //timezone: this.dashboard.getTimezone(),
      //panelId: this.panel.id,
      //dashboardId: this.$scope.ctrl.dashboard.id,
      range: range,
      rangeRaw: range.raw,
      interval: '5s',
      //intervalMs: 60000,
      //{ "refId": "B", "target": "upper_75" }
      //targets:
      //targets: [this.currentDatasource.queryModel.target],

      maxDataPoints: 2495,
      //scopedVars: {},
      cacheTimeout: null,
      format: 'json',
    };

    console.log(metricsQuery);

    this.$scope.ctrl.panel.mostRecentDataTime = this.$scope.ctrl.currentDatasource.query(metricsQuery);

    console.log(this.$scope.ctrl.panel.mostRecentDataTime);
  }

  datasourceChanged() {
    return this.datasourceSrv.get(this.currentAnnotation.datasource).then(ds => {
      this.$scope.ctrl.currentDatasource = ds;
      this.$scope.ctrl.datasourceName = ds.name;
      console.log(this.$scope.ctrl);
    });
  }

  toggleOptions() {
    this.helpOpen = false;
    this.queryTroubleshooterOpen = false;
    this.optionsOpen = !this.optionsOpen;
  }

  toggleQueryTroubleshooter() {
    this.helpOpen = false;
    this.optionsOpen = false;
    this.queryTroubleshooterOpen = !this.queryTroubleshooterOpen;
  }

  onRefresh() {
    const time = angular.copy(this.timeSrv.timeRange());
    const timeRaw = angular.copy(time.raw);

    if (!this.dashboard.isTimezoneUtc()) {
      time.from.local();
      time.to.local();
      if (moment.isMoment(timeRaw.from)) {
        timeRaw.from.local();
      }
      if (moment.isMoment(timeRaw.to)) {
        timeRaw.to.local();
      }
      this.isUtc = false;
    } else {
      this.isUtc = true;
    }

    this.rangeString = rangeUtil.describeTimeRange(timeRaw);
    this.absolute = { fromJs: time.from.toDate(), toJs: time.to.toDate() };
    this.tooltip = this.dashboard.formatDate(time.from) + ' <br>to<br>';
    this.tooltip += this.dashboard.formatDate(time.to);
    this.timeRaw = timeRaw;
    this.isAbsolute = moment.isMoment(this.timeRaw.to);
  }

  zoom(factor) {
    this.$rootScope.appEvent('zoom-out', 2);
  }

  move(direction) {
    const range = this.timeSrv.timeRange();

    const timespan = (range.to.valueOf() - range.from.valueOf()) / 2;
    let to, from;
    if (direction === -1) {
      to = range.to.valueOf() - timespan;
      from = range.from.valueOf() - timespan;
    } else if (direction === 1) {
      to = range.to.valueOf() + timespan;
      from = range.from.valueOf() + timespan;
      if (to > Date.now() && range.to < Date.now()) {
        to = Date.now();
        from = range.from.valueOf();
      }
    } else {
      to = range.to.valueOf();
      from = range.from.valueOf();
    }

    this.timeSrv.setTime({ from: moment.utc(from), to: moment.utc(to) });
  }

  openDropdown() {
    if (this.isOpen) {
      this.closeDropdown();
      return;
    }

    this.onRefresh();
    this.editTimeRaw = this.timeRaw;
    this.timeOptions = rangeUtil.getRelativeTimesList(this.panel, this.rangeString);
    this.refresh = {
      value: this.dashboard.refresh,
      options: _.map(this.panel.refresh_intervals, (interval: any) => {
        return { text: interval, value: interval };
      }),
    };

    this.refresh.options.unshift({ text: 'off' });
    this.isOpen = true;
    this.$rootScope.appEvent('timepickerOpen');
  }

  closeDropdown() {
    this.isOpen = false;
    this.$rootScope.appEvent('timepickerClosed');
  }

  applyCustom() {
    if (this.refresh.value !== this.dashboard.refresh) {
      this.timeSrv.setAutoRefresh(this.refresh.value);
    }

    this.timeSrv.setTime(this.editTimeRaw);
    this.closeDropdown();
  }

  absoluteFromChanged() {
    this.editTimeRaw.from = this.getAbsoluteMomentForTimezone(this.absolute.fromJs);
  }

  absoluteToChanged() {
    this.editTimeRaw.to = this.getAbsoluteMomentForTimezone(this.absolute.toJs);
  }

  getAbsoluteMomentForTimezone(jsDate) {
    return this.dashboard.isTimezoneUtc() ? moment(jsDate).utc() : moment(jsDate);
  }

  setRelativeFilter(timespan) {
    if (timespan.display === 'Reset') {
      // set range to be equal to URL parameters when the page was opened.
      let to, from;
      to = this.startingTimeRange.to.valueOf();
      from = this.startingTimeRange.from.valueOf();
      this.timeSrv.setTime({ from: moment.utc(from), to: moment.utc(to) });
    } else if (timespan.display === 'Most recent data') {
      // set range to be the most recent data
      //TODO: discover (in a datasource-independent way) the most recent data in the dashboard.
    } else {
      const range = { from: timespan.from, to: timespan.to };

      if (this.panel.nowDelay && range.to === 'now') {
        range.to = 'now-' + this.panel.nowDelay;
      }

      this.timeSrv.setTime(range);
    }

    this.closeDropdown();
  }
}

export function settingsDirective() {
  return {
    restrict: 'E',
    templateUrl: 'public/app/features/dashboard/components/TimePicker/settings.html',
    controller: TimePickerCtrl,
    bindToController: true,
    controllerAs: 'ctrl',
    scope: {
      dashboard: '=',
    },
  };
}

export function timePickerDirective() {
  return {
    restrict: 'E',
    templateUrl: 'public/app/features/dashboard/components/TimePicker/template.html',
    controller: TimePickerCtrl,
    bindToController: true,
    controllerAs: 'ctrl',
    scope: {
      dashboard: '=',
    },
  };
}

angular.module('grafana.directives').directive('gfTimePickerSettings', settingsDirective);
angular.module('grafana.directives').directive('gfTimePicker', timePickerDirective);

import { inputDateDirective } from './validation';
angular.module('grafana.directives').directive('inputDatetime', inputDateDirective);
