<template>

  <div>
    <h1>{{ $tr('title') }}</h1>
    <sub> {{$tr('subHeading')}} </sub>
    <div v-if="reports.length" class="table-wrapper">
      <table class="report-list">
        <thead>
          <tr>
            <th>{{ $tr('name') }}</th>
            <th>{{ $tr('progress') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="report in reportList">
            <td>
              <content-icon :kind="report.kind"/>
              {{ report.title }}
            </td>
            <td>
              <progress-bar :show-percentage="false" :progress="completedProgress(report.progress[0])"/>
              {{ progressString(report) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-else>
      {{ $tr('noRecentProgress') }}
    </div>
  </div>

</template>


<script>

  const ContentNodeKinds = require('kolibri.coreVue.vuex.constants').ContentNodeKinds;

  module.exports = {
    name: 'coachRecentReports',
    $trNameSpace: 'coachRecentReports',
    $trs: {
      title: 'Recent Activity',
      subHeading: 'Showing recent activity in past 7 days',
      name: 'Name',
      progress: 'Progress',
      noRecentProgress: 'No recent progress',
      reportProgress: '{completed} {descriptor}',
      listened: '{proportionCompleted} listened',
      opened: '{proportionCompleted} opened',
      watched: '{proportionCompleted} watched',
      mastered: '{proportionCompleted} mastered',
    },
    components: {
      'content-icon': require('kolibri.coreVue.components.contentIcon'),
      'progress-bar': require('kolibri.coreVue.components.progressBar'),
    },
    computed: {
      reportList() {
        return Array.from(this.reports).sort(
          (report1, report2) => new Date(report1.lastActive) - new Date(report2.lastActive)
        );
      },
    },
    methods: {
      completedProgress(progress) {
        return progress.logCountComplete / progress.logCountTotal;
      },
      progressString(report) {
        // string representation of a fraction, can't use completedProgress
        const proportionCompleted = `${report.progress[0].logCountComplete}` +
          `/${report.progress[0].logCountTotal}`;
        switch (report.kind) {
          case ContentNodeKinds.AUDIO:
            return this.$tr('listened', { proportionCompleted });
          case ContentNodeKinds.DOCUMENT:
            return this.$tr('opened', { proportionCompleted });
          case ContentNodeKinds.VIDEO:
            return this.$tr('watched', { proportionCompleted });
          case ContentNodeKinds.EXERCISE:
            return this.$tr('mastered', { proportionCompleted });
          case ContentNodeKinds.HTML5:
            return this.$tr('mastered', { proportionCompleted });
          default:
            return this.$tr('mastered', { proportionCompleted });
        }
      }
    },
    vuex: {
      getters: {
        reports: state => state.pageState.reports,
      },
    },
  };

</script>


<style lang="stylus" scoped>

  .report-list
    width: 100%
    th
      text-align: left

</style>
