<template>

  <div>
    <h1>{{ $tr('createNewExam', { channelName: currentChannel.name }) }}</h1>
    <textbox
      :label="$tr('title')"
      :ariaLabel="$tr('title')"
      :placeholder="$tr('enterTitle')"
      :autofocus="false"
      :invalid="titleInvalid"
      :error="$tr('examRequiresTitle')"
      v-model.trim="inputTitle"
      @blur="validateTitle = true"
      @input="validateTitle = true"
    />
    <textbox
      :label="$tr('numQuestions')"
      :ariaLabel="$tr('numQuestions')"
      :placeholder="$tr('enterNum')"
      :invalid="numQuestionsInvalid"
      :error="numQuestionsInvalidMsg"
      type="number"
      v-model.trim.number="inputNumQuestions"
      @blur="validateNumQuestMax = true"
      @input="validateNumQuestMax = true"
    />

    <h2>{{ $tr('chooseExercises') }}</h2>
    <!--<textbox-->
      <!--:ariaLabel="$tr('searchContent')"-->
      <!--:placeholder="$tr('searchContent')"-->
      <!--v-model.trim="searchInput"-->
    <!--/>-->
    <!--<div v-if="searchInput">-->
      <!--search results-->
    <!--</div>-->
    <div>
      <nav>
        <ol>
          <li v-for="(topic, index) in topic.breadcrumbs" :class="breadCrumbClass(index)">
            <button v-if="notLastBreadcrumb(index)" @click="handleGoToTopic(topic.id)">{{ topic.title }}</button>
            <strong v-else>{{ topic.title }}</strong>
          </li>
        </ol>
      </nav>

      <div>
        <transition name="fade" mode="out-in">
          <ui-progress-linear v-if="loading" key="progress"/>

          <table v-else key="table">
            <thead>
              <tr>
                <th class="col-icon"></th>
                <th class="col-title">{{ $tr('title') }}</th>
                <th class="col-add"></th>
              </tr>
            </thead>
            <tbody>
              <exercise-row
                v-for="exercise in exercises"
                :exerciseId="exercise.id"
                :exerciseTitle="exercise.title"
                :exerciseNumAssesments="exercise.numAssesments"
                :selectedExercises="selectedExercises"
                @addExercise="handleAddExercise"
                @removeExercise="handleRemoveExercise"/>
              <topic-row
                v-for="topic in subtopics"
                :topicId="topic.id"
                :topicTitle="topic.title"
                :allExercisesWithinTopic="topic.allExercisesWithinTopic"
                :selectedExercises="selectedExercises"
                @goToTopic="handleGoToTopic"
                @addTopicExercises="handleAddTopicExercises"
                @removeTopicExercises="handleRemoveTopicExercises"/>
            </tbody>
          </table>
        </transition>
      </div>
    </div>

    <div class="footer">
      <p>{{ $tr('selected', { count: selectedExercises.length }) }}</p>
      <p class="validation-error">{{ validationError }}</p>
      <!--
      <icon-button :text="$tr('preview')" @click="preview">
        <mat-svg category="action" name="visibility"/>
      </icon-button>
      -->
      <br>
      <icon-button :text="$tr('finish')" :primary="true" @click="finish"/>
    </div>

    <preview-new-exam-modal
      v-if="showPreviewNewExamModal"
      :examTitle="inputTitle"
      :examNumQuestions="inputNumQuestions"
      :selectedExercises="selectedExercises"
      :seed="seed"
      @randomize="seed = generateRandomSeed()"/>

    <ui-snackbar-container
      class="snackbar-container"
      ref="snackbarContainer"
      position="center"/>
  </div>

</template>


<script>

  const ExamActions = require('../../state/actions/exam');
  const ExamModals = require('../../examConstants').Modals;
  const CollectionKinds = require('kolibri.coreVue.vuex.constants').CollectionKinds;
  const shuffle = require('lodash/shuffle');
  const random = require('lodash/random');

  module.exports = {
    $trNameSpace: 'createExamPage',
    $trs: {
      createNewExam: 'Create a new exam from {channelName}',
      chooseExercises: 'Select exercises to pull questions from',
      title: 'Exam title',
      enterTitle: 'Enter a title',
      numQuestions: 'Number of questions',
      enterNum: 'Enter a number',
      examRequiresTitle: 'The exam requires a title',
      numQuestionsBetween: 'The exam requires a number of questions between 1 and 50',
      numQuestionsExceed: 'The max number of questions based on the exercises you selected is {maxQuestionsFromSelection}. Select more exercises to reach {inputNumQuestions} questions, or lower the number of questions to {maxQuestionsFromSelection}.',
      noneSelected: 'No exercises are selected',
      searchContent: 'Search for content within channel',
      preview: 'Preview',
      finish: 'Finish',
      added: 'Added',
      removed: 'Removed',
      selected: '{count, number, integer} {count, plural, one {Exercise} other {Exercises}} selected'
    },
    data() {
      return {
        selectedChannel: '',
        inputTitle: '',
        inputNumQuestions: '',
        validateTitle: false,
        validateNumQuestMax: false,
        validateNumQuestExceeds: false,
        validationError: '',
        searchInput: '',
        loading: false,
        seed: this.generateRandomSeed(),
      };
    },
    components: {
      'ui-select': require('keen-ui/src/UiSelect'),
      'ui-snackbar': require('keen-ui/src/UiSnackbar'),
      'ui-snackbar-container': require('keen-ui/src/UiSnackbarContainer'),
      'ui-progress-linear': require('keen-ui/src/UiProgressLinear'),
      'icon-button': require('kolibri.coreVue.components.iconButton'),
      'textbox': require('kolibri.coreVue.components.textbox'),
      'topic-row': require('./topic-row'),
      'exercise-row': require('./exercise-row'),
      'preview-new-exam-modal': require('./preview-new-exam-modal'),
    },
    computed: {
      maxQuestionsFromSelection() {
        return this.selectedExercises.reduce((sum, exercise) => sum + exercise.numAssesments, 0);
      },
      titleInvalid() {
        return this.validateTitle ? !this.inputTitle : false;
      },
      numQuestNotWithinRange() {
        return this.validateNumQuestMax ?
          (this.inputNumQuestions < 1) || (this.inputNumQuestions > 50) : false;
      },
      numQuestExceedsSelection() {
        if (this.validateNumQuestExceeds && this.selectedExercises.length) {
          if (this.inputNumQuestions > this.maxQuestionsFromSelection) {
            return true;
          }
        }
        return false;
      },
      numQuestionsInvalid() {
        if (this.numQuestNotWithinRange) {
          return true;
        } else if (this.numQuestExceedsSelection) {
          return true;
        }
        return false;
      },
      numQuestionsInvalidMsg() {
        if (this.numQuestNotWithinRange) {
          return this.$tr('numQuestionsBetween');
        }
        return this.$tr('numQuestionsExceed', {
          inputNumQuestions: this.inputNumQuestions,
          maxQuestionsFromSelection: this.maxQuestionsFromSelection
        });
      },
      showPreviewNewExamModal() {
        return this.examModalShown === ExamModals.PREVIEW_NEW_EXAM;
      },
      questionSources() {
        const shuffledExercises = shuffle(Array.from(this.selectedExercises));
        const numExercises = shuffledExercises.length;
        const numQuestions = this.inputNumQuestions;
        const questionsPerExercise = numQuestions / numExercises;
        const remainingQuestions = numQuestions % numExercises;

        if (remainingQuestions === 0) {
          return shuffledExercises.map(exercise =>
            ({ exercise_id: exercise.id, number_of_questions: Math.trunc(questionsPerExercise) })
          );
        } else if (questionsPerExercise >= 1) {
          return shuffledExercises.map((exercise, index) => {
            if (index < remainingQuestions) {
              return {
                exercise_id: exercise.id,
                number_of_questions: Math.trunc(questionsPerExercise) + 1
              };
            }
            return {
              exercise_id: exercise.id,
              number_of_questions: Math.trunc(questionsPerExercise)
            };
          });
        }
        const exercisesSubset = shuffledExercises;
        exercisesSubset.splice(numQuestions);
        return exercisesSubset.map(
          exercise => ({ exercise_id: exercise.id, number_of_questions: 1 })
        );
      },
    },
    methods: {
      handleGoToTopic(topicId) {
        this.loading = true;
        this.fetchContent(this.currentChannel.id, topicId).then(
          () => {
            this.loading = false;
          },
          error => {}
        );
      },
      handleAddExercise(exercise) {
        this.addExercise(exercise);
        this.$refs.snackbarContainer.createSnackbar({ message: `${this.$tr('added')} ${exercise.title}` });
      },
      handleRemoveExercise(exercise) {
        this.removeExercise(exercise);
        this.$refs.snackbarContainer.createSnackbar({ message: `${this.$tr('removed')} ${exercise.title}` });
      },
      handleAddTopicExercises(allExercisesWithinTopic, topicTitle) {
        allExercisesWithinTopic.forEach(exercise => this.addExercise(exercise));
        this.$refs.snackbarContainer.createSnackbar({ message: `${this.$tr('added')} ${topicTitle}` });
      },
      handleRemoveTopicExercises(allExercisesWithinTopic, topicTitle) {
        allExercisesWithinTopic.forEach(exercise => this.removeExercise(exercise));
        this.$refs.snackbarContainer.createSnackbar({ message: `${this.$tr('removed')} ${topicTitle}` });
      },
      preview() {
        if (this.checkAllValid() === true) {
          this.displayExamModal(ExamModals.PREVIEW_NEW_EXAM);
        }
      },
      finish() {
        if (this.checkAllValid() === true) {
          const classCollection = {
            id: this.currentClass.id,
            name: this.currentClass.name,
            kind: CollectionKinds.CLASSROOM
          };
          const examObj = {
            classId: this.currentClass.id,
            channelId: this.currentChannel.id,
            title: this.inputTitle,
            numQuestions: this.inputNumQuestions,
            questionSources: this.questionSources,
            seed: this.seed,
          };
          this.createExam(classCollection, examObj);
        }
      },
      checkAllValid() {
        this.validateTitle = true;
        this.validateNumQuestMax = true;
        this.validateNumQuestExceeds = true;
        if (!this.titleInvalid && this.selectedExercises.length !== 0 &&
          !this.numQuestNotWithinRange && !this.numQuestExceedsSelection) {
          this.validationError = '';
          return true;
        } else if (this.titleInvalid) {
          this.validationError = this.$tr('examRequiresTitle');
        } else if (this.numQuestNotWithinRange) {
          this.validationError = this.$tr('numQuestionsBetween');
        } else if (this.selectedExercises.length === 0) {
          this.validationError = this.$tr('noneSelected');
        } else if (this.numQuestExceedsSelection) {
          this.validationError = this.$tr('numQuestionsExceed', {
            inputNumQuestions: this.inputNumQuestions,
            maxQuestionsFromSelection: this.maxQuestionsFromSelection
          });
        }
        return false;
      },
      notLastBreadcrumb(index) {
        return index !== this.topic.breadcrumbs.length - 1;
      },
      breadCrumbClass(index) {
        if (this.notLastBreadcrumb(index)) {
          return 'not-last';
        }
        return '';
      },
      generateRandomSeed() {
        return random(1000);
      },
    },
    vuex: {
      getters: {
        currentClass: state => state.pageState.currentClass,
        currentChannel: state => state.pageState.currentChannel,
        topic: state => state.pageState.topic,
        subtopics: state => state.pageState.subtopics,
        exercises: state => state.pageState.exercises,
        selectedExercises: state => state.pageState.selectedExercises,
        examModalShown: state => state.pageState.examModalShown,
      },
      actions: {
        fetchContent: ExamActions.fetchContent,
        createExam: ExamActions.createExam,
        addExercise: ExamActions.addExercise,
        removeExercise: ExamActions.removeExercise,
        displayExamModal: ExamActions.displayExamModal,
      },
    },
  };

</script>


<style lang="stylus" scoped>

  @require '~kolibri.styles.definitions'

  .footer
    text-align: center

    button
      margin: auto
      margin-bottom: 1em

  ol
    padding: 0.5em

  li
    display: inline-block

    button
      vertical-align: baseline
      padding: 0
      border: none
      font-size: 1em


  .not-last
    &:after
      content: '/'
      padding-right: 0.5em
      padding-left: 0.5em

  .snackbar-container
    position: fixed
    bottom: 0
    z-index: 6

  .fade-enter-active, .fade-leave-active
    transition: opacity 0.1s

  .fade-enter, .fade-leave-to .fade-leave-active
    opacity: 0

  .validation-error
    color: $core-text-error

  table
    width: 100%

  .col-title
    text-align: left
    width: 100%

</style>
