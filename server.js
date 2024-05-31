const express = require("express");
const mysql = require("mysql2/promise");
const cors = require("cors");
const session = require("express-session");

const app = express();

// Configuración CORS para permitir acceso desde https://softdcc.com/w24011703
app.use(
  cors({
    origin: "http://softdcc.com/w24011703",
    credentials: true,
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    allowedHeaders: "Content-Type, Authorization, Content-Length, X-Requested-With",
  })
);

app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use(express.json());

app.use(
  session({
    secret: "secret",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 980000 },
  })
);


const pool = mysql.createPool({
  host: "34.70.216.191",
  user: "root",
  password: "12345678",
  database: "proyecto2024",
  connectionLimit: 5,
});

app.post("/login", async (req, res) => {
  const { noControl, password } = req.body;
  console.log("Credenciales recibidas:", noControl, password);

  try {
    const conn = await pool.getConnection();
    const [rows] = await conn.query(
      "SELECT * FROM alumnos WHERE noControl = ? AND password = ?",
      [noControl, password]
    );
    conn.release();

    if (rows.length > 0) {
      req.session.regenerate((err) => {
        if (err) {
          console.error("Error al regenerar la sesión:", err);
          return res.status(500).json({ error: "Error al regenerar la sesión" });
        }

        req.session.noControl = noControl;
        res.status(200).json({ message: "Sesión iniciada exitosamente", noControl });
      });
    } else {
      res.status(401).json({ error: "Credenciales incorrectas" });
    }
  } catch (error) {
    console.error("Error al iniciar sesión: ", error);
    res.status(500).json({ error: "Error al iniciar sesión" });
  }
});

app.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: "Error al cerrar sesión" });
    }
    res.status(200).json({ message: "Sesión cerrada exitosamente" });
  });
});

app.get("/Misgrupos", async (req, res) => {
  if (!req.session.noControl) {
    return res.status(401).json({ error: "No autorizado" });
  }
  const noControl = req.session.noControl;
  console.log(noControl);
  try {
    const conn = await pool.getConnection();
    const [rows] = await conn.query(
      "SELECT * FROM vtaalumnogrupos WHERE noControl = ?",
      [noControl]
    );
    conn.release();
    if (rows.length > 0) {
      res.status(200).json(rows);
    } else {
      res.status(404).json({ error: "No tienes grupos" });
    }
  } catch (error) {
    console.error("Error al obtener asistencias: ", error);
    res.status(500).json({ error: "Error al obtener asistencias" });
  }
});

app.post("/pasarLista", async (req, res) => {
  const { noControl, idmateria, idgrupo, idprofesor, fecha, hora, reg_fecha, status } = req.body;
  try {
    const horaSinSegundos = hora.slice(0, 5);
    const regFechaCompleta = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const conn = await pool.getConnection();

    await conn.query(
      "INSERT INTO asistencia (noControl, idmateria, idgrupo, idprofesor, fecha, hora, reg_fecha, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [noControl, idmateria, idgrupo, idprofesor, fecha, horaSinSegundos, regFechaCompleta, "1"]
    );
    conn.release();
    res.status(201).json({ message: "Asistencia registrada exitosamente" });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      res.status(400).json({ error: "Ya has registrado asistencia para esta clase en esta fecha." });
    } else {
      console.error("Error al registrar asistencia: ", error);
      res.status(500).json({ error: "Error al registrar asistencia" });
    }
  }
});

app.post("/register", async (req, res) => {
  const { noControl, nombre, apellidos, telefono, email, password, status } = req.body;
  try {
    const conn = await pool.getConnection();
    const [rows] = await conn.query("SELECT * FROM alumnos WHERE noControl = ?", [noControl]);
    if (rows.length > 0) {
      conn.release();
      return res.status(400).json({ message: "El usuario ya existe" });
    }
    await conn.query(
      "INSERT INTO alumnos (noControl, nombre, apellidos, telefono, email, password, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [noControl, nombre, apellidos, telefono, email, password, status]
    );
    conn.release();
    res.status(201).json({ message: "Usuario registrado exitosamente" });
  } catch (error) {
    console.error("Error al registrar usuario: ", error);
    res.status(500).json({ error: "Error al registrar usuario", details: error.message });
  }
});

app.get('/gruposDisponibles', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM proyecto2024.vtaprofesorgrupos');
    res.json(rows);
  } catch (error) {
    console.error('Error fetching data:', error);
    res.status(500).json({ error: 'Error fetching data' });
  }
});

app.post('/registrarGrupo', async (req, res) => {
  const { noControl, idmateria, idgrupo, idprofesor } = req.body;

  try {
    const [existingRows] = await pool.query(
      "SELECT * FROM alumnogrupos WHERE noControl = ? AND idmateria = ? AND idgrupo = ? AND idprofesor = ?",
      [noControl, idmateria, idgrupo, idprofesor]
    );

    if (existingRows.length > 0) {
      return res.status(400).json({ error: "Ya estás registrado en este grupo" });
    }

    await pool.query(
      "INSERT INTO alumnogrupos (noControl, idprofesor, idmateria, idgrupo, status) VALUES (?, ?, ?, ?, '1')",
      [noControl, idprofesor, idmateria, idgrupo]
    );

    res.status(201).json({ message: "Registrado en el grupo exitosamente" });
  } catch (error) {
    console.error("Error al registrar grupo: ", error);
    res.status(500).json({ error: "Error al registrar grupo" });
  }
});

app.delete('/eliminarGrupo', async (req, res) => {
  const { noControl, idprofesor, idmateria, idgrupo } = req.body;

  try {
    const conn = await pool.getConnection();
    const [result] = await conn.query(
      'DELETE FROM alumnogrupos WHERE noControl = ? AND idprofesor = ? AND idmateria = ? AND idgrupo = ?',
      [noControl, idprofesor, idmateria, idgrupo]
    );
    conn.release();

    if (result.affectedRows > 0) {
      res.status(200).json({ message: 'Grupo eliminado exitosamente' });
    } else {
      res.status(404).json({ error: 'Grupo no encontrado' });
    }
  } catch (error) {
    console.error('Error al eliminar grupo: ', error);
    res.status(500).json({ error: 'Error al eliminar grupo' });
  }
});

app.get('/asistencias/:noControl/:idprofesor/:idmateria/:idgrupo', async (req, res) => {
  const { noControl, idprofesor, idmateria, idgrupo } = req.params;

  try {
    const conn = await pool.getConnection();
    const [rows] = await conn.query(
      `SELECT noControl, idprofesor, idmateria, idgrupo, 
              CONCAT(fecha, ' ', hora) AS fecha
       FROM asistencia 
       WHERE noControl = ? 
         AND idprofesor = ?
         AND idmateria = ?
         AND idgrupo = ?`,
      [noControl, idprofesor, idmateria, idgrupo]
    );
    conn.release();

    if (rows.length > 0) {
      res.status(200).json(rows);
    } else {
      res.status(404).json({ error: "No se encontraron asistencias" });
    }
  } catch (error) {
    console.error("Error al obtener asistencias: ", error);
    res.status(500).json({ error: "Error al obtener asistencias" });
  }
});

const PORT = 3001;
const HOST = 'localhost';

app.listen(PORT, HOST, () => {
  console.log(`Servidor escuchando en http://${HOST}:${PORT}`);
});
