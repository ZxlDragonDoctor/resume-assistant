package com.zxl.resume.common.mybatis;

import org.apache.ibatis.type.BaseTypeHandler;
import org.apache.ibatis.type.JdbcType;
import org.apache.ibatis.type.MappedTypes;
import org.postgresql.util.PGobject;

import java.sql.CallableStatement;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;

@MappedTypes({String.class})
public class JsonbTypeHandler extends BaseTypeHandler<String> {

    @Override
    public void setNonNullParameter(PreparedStatement ps, int i, String parameter, JdbcType jdbcType) throws SQLException {
        PGobject obj = new PGobject();
        obj.setType("jsonb");
        obj.setValue(parameter);
        ps.setObject(i, obj);
    }

    @Override
    public String getNullableResult(ResultSet rs, String columnName) throws SQLException {
        Object val = rs.getObject(columnName);
        return val == null ? null : val.toString();
    }

    @Override
    public String getNullableResult(ResultSet rs, int columnIndex) throws SQLException {
        Object val = rs.getObject(columnIndex);
        return val == null ? null : val.toString();
    }

    @Override
    public String getNullableResult(CallableStatement cs, int columnIndex) throws SQLException {
        Object val = cs.getObject(columnIndex);
        return val == null ? null : val.toString();
    }
}
