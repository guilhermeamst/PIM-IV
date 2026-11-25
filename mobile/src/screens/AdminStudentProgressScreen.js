import React, { useCallback, useState } from 'react';
import { ScrollView, Text, View, RefreshControl, Alert, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import api from '../services/api';
import ProgressBar from '../components/ProgressBar';
export default function AdminStudentProgressScreen({
  route
}) {
  const {
    id,
    nome
  } = route.params;
  const [courses, setCourses] = useState([]),
    [stats, setStats] = useState(null),
    [loading, setLoading] = useState(false);
  async function load() {
    setLoading(true);
    try {
      const [p, g] = await Promise.all([api.get(`/progresso/alunos/${id}`), api.get(`/gamificacao/alunos/${id}`)]);
      setCourses(p.data.filter(c => c.matriculado));
      setStats(g.data);
    } catch (e) {
      setCourses([]);
      setStats(null);
      Alert.alert('Erro', e.response?.data?.message || 'Falha ao consultar progresso.');
    } finally {
      setLoading(false);
    }
  }
  useFocusEffect(useCallback(() => {
    load();
  }, [id]));
  return <ScrollView contentContainerStyle={styles.page} refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}><Text style={styles.title}>{nome}</Text>{stats && <View style={styles.card}><Text>XP: {stats.xp} • Nível: {stats.nivel}</Text><Text>Sequência: {stats.sequenciaAtual} • Melhor: {stats.melhorSequencia}</Text></View>}<Text style={styles.title}>Cursos matriculados</Text>{courses.map(c => <View key={c.id} style={styles.card}><Text style={styles.name}>{c.titulo}</Text><ProgressBar value={c.progresso} /><Text>{c.concluidas} de {c.totalAulas} aulas • {c.progresso}%</Text></View>)}{!loading && !courses.length && <Text>Nenhuma matrícula disponível.</Text>}</ScrollView>;
}
const styles = StyleSheet.create({
  page: {
    padding: 18,
    backgroundColor: '#f4f6f8',
    flexGrow: 1,
    gap: 12
  },
  title: {
    fontSize: 22,
    fontWeight: '800'
  },
  card: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 12,
    gap: 8
  },
  name: {
    fontWeight: '700'
  }
});
