import React, { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import api from '../services/api';
export default function AdminCourseScreen({
  route,
  navigation
}) {
  const edit = route.params?.mode === 'edit';
  const initial = route.params?.course;
  const [titulo, setTitulo] = useState(initial?.titulo || '');
  const [descricao, setDescricao] = useState(initial?.descricao || '');
  const [carga, setCarga] = useState(String(initial?.cargaHoraria || ''));
  const [ativo, setAtivo] = useState(initial?.ativo !== false);
  const [professorId, setProfessorId] = useState(initial?.professorId ?? null);
  const [professores, setProfessores] = useState([]);
  const [professorModal, setProfessorModal] = useState(false);
  const [courseReady, setCourseReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [aulas, setAulas] = useState([]);
  const [aulaTitulo, setAulaTitulo] = useState('');
  const [aulaDuracao, setAulaDuracao] = useState('45');
  const [aulaConteudo, setAulaConteudo] = useState('');
  const [editingLesson, setEditingLesson] = useState(null);
  const [lessonBusy, setLessonBusy] = useState(false);
  function resetLesson() {
    setEditingLesson(null);
    setAulaTitulo('');
    setAulaDuracao('45');
    setAulaConteudo('');
  }
  async function editLesson(aula) {
    if (lessonBusy) return;
    setLessonBusy(true);
    try {
      const {
        data
      } = await api.get(`/aulas/${aula.id}`);
      setEditingLesson(aula.id);
      setAulaTitulo(data.titulo);
      setAulaDuracao(String(data.duracaoMin));
      setAulaConteudo(data.conteudo || '');
    } catch (e) {
      Alert.alert('Erro', e.response?.data?.message || 'Falha ao carregar aula.');
    } finally {
      setLessonBusy(false);
    }
  }
  useEffect(() => {
    carregarFormulario();
  }, []);

  async function carregarFormulario() {
    setCourseReady(false);

    try {
      const [usuarios, curso] = await Promise.all([
        api.get('/admin/usuarios'),
        edit ? api.get(`/cursos/${initial.id}`) : Promise.resolve(null)
      ]);

      setProfessores(usuarios.data.filter(usuario =>
        usuario.perfil === 'PROFESSOR' && usuario.ativo
      ));

      if (curso) {
        setProfessorId(curso.data.professorId ?? null);
        setTitulo(curso.data.titulo);
        setDescricao(curso.data.descricao || '');
        setCarga(String(curso.data.cargaHoraria ?? 0));
        setAtivo(Boolean(curso.data.ativo));
        setAulas(curso.data.aulas);
      }

      setCourseReady(true);
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível carregar o curso ou os professores.');
    }
  }

  async function load() {
    try {
      const response = await api.get(`/cursos/${initial.id}`);
      setAulas(response.data.aulas);
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível carregar as aulas.');
    }
  }

  async function salvar() {
    if (!courseReady || saving) return;

    if (professorId !== null && !professores.some(p => p.id === professorId)) {
      Alert.alert('Atenção', 'Selecione um professor ativo ou deixe o curso sem professor.');
      return;
    }

    setSaving(true);

    try {
      const dadosCurso = {
        titulo,
        descricao,
        cargaHoraria: Number(carga),
        ativo,
        professorId
      };

      if (edit) {
        await api.put(`/admin/cursos/${initial.id}`, dadosCurso);
      } else {
        await api.post('/admin/cursos', dadosCurso);
      }

      Alert.alert('Sucesso', edit ? 'Curso atualizado.' : 'Curso criado.', [{
        text: 'OK',
        onPress: () => navigation.goBack()
      }]);
    } catch (error) {
      Alert.alert('Erro', error.response?.data?.message || 'Falha ao salvar.');
    } finally {
      setSaving(false);
    }
  }

  async function addAula() {
    if (lessonBusy) return;
    const titulo = aulaTitulo.trim(),
      duracaoMin = Number(aulaDuracao);
    if (!titulo || titulo.length > 300 || !aulaDuracao.trim() || !Number.isInteger(duracaoMin) || duracaoMin < 0 || duracaoMin > 2147483647) return Alert.alert('Atenção', 'Informe título e duração válidos.');
    setLessonBusy(true);
    try {
      const payload = {
        titulo,
        duracaoMin,
        conteudo: aulaConteudo
      };
      if (editingLesson) await api.put(`/admin/aulas/${editingLesson}`, payload);else await api.post(`/admin/cursos/${initial.id}/aulas`, payload);
      resetLesson();
      await load();
    } catch (e) {
      Alert.alert('Erro', e.response?.data?.message || 'Falha ao salvar aula.');
    } finally {
      setLessonBusy(false);
    }
  }
  async function delAula(id) {
    try {
      await api.delete(`/admin/aulas/${id}`);
      await load();
    } catch (error) {
      Alert.alert('Erro', error.response?.data?.message || 'Falha ao excluir aula.');
    }
  }
  function excluir() {
    Alert.alert('Excluir', 'Deseja excluir este curso?', [{
      text: 'Cancelar'
    }, {
      text: 'Excluir',
      style: 'destructive',
      onPress: async () => {
        try {
          await api.delete(`/admin/cursos/${initial.id}`);
          navigation.goBack();
        } catch (error) {
          Alert.alert('Erro', error.response?.data?.message || 'Falha ao excluir.');
        }
      }
    }]);
  }
  return <ScrollView style={styles.container}>
      <Text style={styles.title}>
        {edit ? 'Editar curso' : 'Novo curso'}
      </Text>

      <TextInput style={styles.input} placeholder="Título" value={titulo} onChangeText={setTitulo} />

      <TextInput style={[styles.input, styles.textArea]} placeholder="Descrição" multiline value={descricao} onChangeText={setDescricao} />

      <TextInput style={styles.input} placeholder="Carga horária" keyboardType="numeric" value={carga} onChangeText={setCarga} />

      <View style={styles.switchContainer}>
        <Text>Curso ativo</Text>

        <Switch value={ativo} onValueChange={setAtivo} />
      </View>

      <Text style={styles.fieldLabel}>Professor responsável</Text>
      <Pressable
        style={styles.input}
        disabled={!courseReady || saving}
        onPress={() => setProfessorModal(true)}
      >
        <Text style={professorId === null ? styles.unassigned : null}>
          {professorId === null
            ? 'Sem professor'
            : professores.find(p => p.id === professorId)?.nome || 'Professor indisponível'}
        </Text>
      </Pressable>

      <Modal
        visible={professorModal}
        transparent
        animationType="fade"
        onRequestClose={() => setProfessorModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalPanel}>
            <Text style={styles.heading}>Escolher professor</Text>
            <ScrollView>
              {[{ id: null, nome: 'Sem professor' }, ...professores].map(professor => (
                <Pressable
                  key={String(professor.id)}
                  style={styles.option}
                  onPress={() => {
                    setProfessorId(professor.id);
                    setProfessorModal(false);
                  }}
                >
                  <Text>{professor.nome}{professor.id === professorId ? ' ✓' : ''}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Pressable style={styles.option} onPress={() => setProfessorModal(false)}>
              <Text style={styles.secondaryButtonText}>Cancelar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {!courseReady && (
        <Pressable style={styles.secondaryButton} onPress={carregarFormulario}>
          <Text style={styles.secondaryButtonText}>Recarregar dados</Text>
        </Pressable>
      )}

      <Pressable
        style={[styles.button, (!courseReady || saving) && styles.disabled]}
        disabled={!courseReady || saving}
        onPress={salvar}
      >
        <Text style={styles.buttonText}>
          Salvar curso
        </Text>
      </Pressable>

      {edit && <>
          <Text style={styles.heading}>
            Aulas
          </Text>

          {aulas.map(aula => <View style={styles.lesson} key={aula.id}>
              <View style={styles.lessonInfo}>
                <Text style={styles.lessonTitle}>
                  {aula.ordem}. {aula.titulo}
                </Text>

                <Text>
                  {aula.duracaoMin} min
                </Text>
              </View>

              <Pressable disabled={lessonBusy} onPress={() => editLesson(aula)}><Text style={{
            color: "#2563eb",
            padding: 5,
            fontWeight: "700"
          }}>Editar</Text></Pressable>
              <Pressable onPress={() => delAula(aula.id)}>
                <Text style={styles.deleteText}>
                  Excluir
                </Text>
              </Pressable>
            </View>)}

          <TextInput style={styles.input} placeholder="Título da nova aula" value={aulaTitulo} onChangeText={setAulaTitulo} />

          <TextInput style={styles.input} placeholder="Duração em minutos" keyboardType="numeric" value={aulaDuracao} onChangeText={setAulaDuracao} />

          <TextInput style={[styles.input, styles.textArea]} placeholder="Conteúdo da aula" multiline value={aulaConteudo} onChangeText={setAulaConteudo} editable={!lessonBusy} />
          {editingLesson && <Pressable onPress={resetLesson} disabled={lessonBusy}><Text style={{
          color: "#2563eb",
          padding: 10
        }}>Cancelar edição</Text></Pressable>}
          <Pressable style={styles.secondaryButton} disabled={lessonBusy} onPress={addAula}>
            <Text style={styles.secondaryButtonText}>
              {editingLesson ? 'Salvar aula' : 'Adicionar aula'}
            </Text>
          </Pressable>

          <Pressable style={styles.dangerButton} onPress={excluir}>
            <Text style={styles.buttonText}>
              Excluir curso
            </Text>
          </Pressable>
        </>}
    </ScrollView>;
}
const styles = StyleSheet.create({
  fieldLabel: {
    fontWeight: '700',
    marginBottom: 8
  },
  unassigned: {
    color: '#B45309',
    fontWeight: '700'
  },
  disabled: {
    opacity: 0.5
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#00000066'
  },
  modalPanel: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 18,
    maxHeight: '80%'
  },
  option: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee'
  },
  container: {
    flex: 1,
    backgroundColor: '#f4f6f8',
    padding: 18
  },
  title: {
    fontSize: 25,
    fontWeight: '800',
    marginBottom: 18
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 13,
    marginBottom: 10
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top'
  },
  switchContainer: {
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12
  },
  button: {
    backgroundColor: '#2563eb',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center'
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700'
  },
  heading: {
    fontSize: 20,
    fontWeight: '800',
    marginVertical: 18
  },
  lesson: {
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 10,
    flexDirection: 'row',
    marginBottom: 8
  },
  lessonInfo: {
    flex: 1
  },
  lessonTitle: {
    fontWeight: '700'
  },
  deleteText: {
    color: '#dc2626',
    fontWeight: '700'
  },
  secondaryButton: {
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2563eb',
    alignItems: 'center'
  },
  secondaryButtonText: {
    color: '#2563eb',
    fontWeight: '700'
  },
  dangerButton: {
    backgroundColor: '#dc2626',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginVertical: 20
  }
});
